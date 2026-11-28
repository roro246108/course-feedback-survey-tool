// Loads secrets for the Survey Management and Survey Reminder Lambdas.
//
// In AWS, each Lambda receives the ARN of its own Secrets Manager secret in
// SECRETS_ARN. The secret is a JSON object, for example:
//   { "DATABASE_URL": "...", "ACCESS_TOKEN_SECRET": "..." }
// Only the keys listed in ALLOWED_SECRET_KEYS are copied into process.env.
// Values that are already set in the environment are never overwritten, so
// local runs can rely on backend/.env without contacting AWS.
//
// Secret values are never logged or returned.

const ALLOWED_SECRET_KEYS = Object.freeze([
    'DATABASE_URL',
    'ACCESS_TOKEN_SECRET',
    'BREVO_API_KEY'
]);

class RuntimeConfigError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'RuntimeConfigError';
        this.code = code;
        this.details = details;
    }
}

const defaultSecretsClientFactory = () => {
    const {
        SecretsManagerClient,
        GetSecretValueCommand
    } = require('@aws-sdk/client-secrets-manager');

    const client = new SecretsManagerClient({});

    return {
        getSecretString: async (secretId) => {
            const result = await client.send(
                new GetSecretValueCommand({ SecretId: secretId })
            );
            return result.SecretString;
        }
    };
};

const parseSecret = (secretString) => {
    if (typeof secretString !== 'string' || !secretString.trim()) {
        throw new RuntimeConfigError(
            'The configured secret is empty.',
            'SECRET_EMPTY'
        );
    }

    let parsed;
    try {
        parsed = JSON.parse(secretString);
    } catch {
        throw new RuntimeConfigError(
            'The configured secret must be a JSON object.',
            'SECRET_INVALID_JSON'
        );
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new RuntimeConfigError(
            'The configured secret must be a JSON object.',
            'SECRET_INVALID_JSON'
        );
    }

    return parsed;
};

const isMissing = (value) =>
    typeof value !== 'string' || value.trim() === '';

const createRuntimeConfigLoader = ({
    env = process.env,
    secretsClientFactory = defaultSecretsClientFactory
} = {}) => {
    let loadPromise = null;

    const loadOnce = async (requiredKeys) => {
        const secretId = env.SECRETS_ARN;
        const loadedKeys = [];

        if (!isMissing(secretId)) {
            let secretString;
            try {
                secretString = await secretsClientFactory()
                    .getSecretString(secretId);
            } catch (error) {
                throw new RuntimeConfigError(
                    'The Lambda secret could not be read.',
                    'SECRET_READ_FAILED',
                    { awsErrorName: error && error.name }
                );
            }

            const secret = parseSecret(secretString);

            for (const key of ALLOWED_SECRET_KEYS) {
                if (isMissing(env[key]) && !isMissing(secret[key])) {
                    env[key] = secret[key];
                    loadedKeys.push(key);
                }
            }
        }

        const missingKeys = requiredKeys.filter(key => isMissing(env[key]));

        if (missingKeys.length > 0) {
            // Only key names are reported, never values.
            throw new RuntimeConfigError(
                `Missing required configuration: ${missingKeys.join(', ')}`,
                'CONFIG_MISSING',
                { missingKeys }
            );
        }

        return { loadedKeys, usedSecretsManager: !isMissing(secretId) };
    };

    const load = ({ requiredKeys = [] } = {}) => {
        if (!loadPromise) {
            loadPromise = loadOnce(requiredKeys).catch((error) => {
                // Allow the next invocation to retry after a failure.
                loadPromise = null;
                throw error;
            });
        }

        return loadPromise;
    };

    return { load };
};

module.exports = {
    ALLOWED_SECRET_KEYS,
    RuntimeConfigError,
    createRuntimeConfigLoader
};
