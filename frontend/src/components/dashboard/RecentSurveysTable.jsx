function RecentSurveysTable({ data }) {
  return (
    <div className="rounded-xl border border-[#E5E8E3] bg-white p-6 shadow-sm">

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[#2B5748]">
          Recent Surveys
        </h2>

        <p className="mt-1 text-sm text-[#899187]">
          Latest surveys created in the system
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">

          <thead>
            <tr className="border-b border-[#E5E8E3] text-sm text-[#899187]">
              <th className="px-4 py-3 font-medium">Survey Title</th>
              <th className="px-4 py-3 font-medium">Course</th>
              <th className="px-4 py-3 font-medium">Instructor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created At</th>
            </tr>
          </thead>

          <tbody>
            {data.length > 0 ? (
              data.map((survey) => (
                <tr
                  key={survey.survey_id}
                  className="border-b border-[#E5E8E3] last:border-0"
                >
                  <td className="px-4 py-4 text-sm font-medium text-[#2B5748]">
                    {survey.title}
                  </td>

                  <td className="px-4 py-4 text-sm text-[#4B5545]">
                    {survey.course_name}
                  </td>

                  <td className="px-4 py-4 text-sm text-[#4B5545]">
                    {survey.instructor_name}
                  </td>

                  <td className="px-4 py-4">
                    <span className="rounded-full bg-[#E8EFE9] px-3 py-1 text-xs font-medium text-[#2B5748]">
                      {survey.status}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-sm text-[#899187]">
                    {new Date(survey.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="5"
                  className="px-4 py-8 text-center text-sm text-[#899187]"
                >
                  No surveys found.
                </td>
              </tr>
            )}
          </tbody>

        </table>
      </div>

    </div>
  );
}

export default RecentSurveysTable;