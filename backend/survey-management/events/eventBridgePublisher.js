// Reusable EventBridge publisher adapter for Survey Management.
// Controllers and business logic never call EventBridge directly; the
// Lambda layer uses this adapter through surveyLifecycleNotifier.

class EventPublishError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'EventPublishError';
        this.code = code;
        this.details = details;
    }
}

const defaultClientFactory = () => {
    const {
        EventBridgeClient,
        PutEventsCommand
    } = require('@aws-sdk/client-eventbridge');

    const client = new EventBridgeClient({});

    return {
        putEvents: (entries) =>
            client.send(new PutEventsCommand({ Entries: entries }))
    };
};

const createEventBridgePublisher = ({
    eventBusName,
    clientFactory = defaultClientFactory
} = {}) => {
    if (typeof eventBusName !== 'string' || !eventBusName.trim()) {
        throw new EventPublishError(
            'An EventBridge bus name is required.',
            'EVENT_BUS_NOT_CONFIGURED'
        );
    }

    let client = null;
    const getClient = () => {
        if (!client) client = clientFactory();
        return client;
    };

    const publish = async (event) => {
        if (
            !event ||
            typeof event.source !== 'string' ||
            typeof event.detailType !== 'string' ||
            !event.detail ||
            typeof event.detail !== 'object'
        ) {
            throw new EventPublishError(
                'Invalid event.',
                'EVENT_INVALID'
            );
        }

        const entry = {
            EventBusName: eventBusName,
            Source: event.source,
            DetailType: event.detailType,
            Detail: JSON.stringify(event.detail),
            ...(event.time ? { Time: new Date(event.time) } : {})
        };

        let result;
        try {
            result = await getClient().putEvents([entry]);
        } catch (error) {
            throw new EventPublishError(
                'EventBridge PutEvents request failed.',
                'EVENT_PUBLISH_REQUEST_FAILED',
                { awsErrorName: error && error.name }
            );
        }

        const failedCount = Number(result && result.FailedEntryCount) || 0;
        const firstEntry = result && Array.isArray(result.Entries)
            ? result.Entries[0]
            : null;

        if (failedCount > 0 || !firstEntry || firstEntry.ErrorCode) {
            throw new EventPublishError(
                'EventBridge rejected the event.',
                'EVENT_PUBLISH_REJECTED',
                { errorCode: firstEntry && firstEntry.ErrorCode }
            );
        }

        return {
            published: true,
            eventBridgeEventId: firstEntry.EventId || null
        };
    };

    return { publish, eventBusName };
};

// Used when events are disabled (for example, local runs).
const createDisabledPublisher = () => ({
    publish: async () => ({ published: false, skipped: true }),
    eventBusName: null
});

module.exports = {
    EventPublishError,
    createDisabledPublisher,
    createEventBridgePublisher
};
