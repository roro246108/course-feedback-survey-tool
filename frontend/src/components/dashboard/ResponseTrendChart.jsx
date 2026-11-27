import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

function ResponseTrendChart({ data }) {
  return (
    <div className="rounded-xl border border-[#E5E8E3] bg-white p-6 shadow-sm">

      <h2 className="text-lg font-semibold text-[#2B5748]">
        Response Trend
      </h2>

      <p className="mt-1 text-sm text-[#899187]">
        Feedback responses over the last 6 months
      </p>

      <div className="mt-6 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>

            <CartesianGrid strokeDasharray="3 3" stroke="#E5E8E3" />

            <XAxis
              dataKey="month"
              stroke="#899187"
            />

            <YAxis
              allowDecimals={false}
              stroke="#899187"
            />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="responses"
              stroke="#2B5748"
              strokeWidth={3}
              dot={{ fill: '#A6B398', r: 5 }}
              activeDot={{ r: 7 }}
            />

          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}

export default ResponseTrendChart;