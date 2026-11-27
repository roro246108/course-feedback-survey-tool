import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

const COLORS = ['#DED4AF', '#2B5748', '#A6B398'];

function SurveyStatusChart({ data }) {
  return (
    <div className="rounded-xl border border-[#E5E8E3] bg-white p-6 shadow-sm">

      <h2 className="text-lg font-semibold text-[#2B5748]">
        Survey Status
      </h2>

      <p className="mt-1 text-sm text-[#899187]">
        Distribution of surveys by status
      </p>

      <div className="mt-6 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="status"
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={105}
              paddingAngle={4}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.status}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>

            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}

export default SurveyStatusChart;