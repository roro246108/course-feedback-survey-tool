
import useDashboard from '../../hooks/useDashboard';
import dashboardBg from '../../assets/admin_photo.jpg';

import ResponseTrendChart from '../../components/dashboard/ResponseTrendChart';
import SurveyStatusChart from '../../components/dashboard/SurveyStatusChart';
import RecentSurveysTable from '../../components/dashboard/RecentSurveysTable';
import QuickActions from '../../components/dashboard/QuickActions';

import {
  ClipboardList,
  Users,
  GraduationCap,
  ChartNoAxesColumnIncreasing
} from 'lucide-react';

function Dashboard() {
  const {
    stats,
    responseTrend,
    surveyStatus,
    recentSurveys,
    loading,
    error
  } = useDashboard();

  const statCards = [
    {
      title: 'Total Surveys',
      value: stats?.total_surveys,
      icon: ClipboardList,
      background: 'bg-[#E1E9E0]',
      iconColor: 'text-[#315B45]'
    },
    {
      title: 'Published Surveys',
      value: stats?.published_surveys,
      icon: Users,
      background: 'bg-[#E8E8D5]',
      iconColor: 'text-[#66733D]'
    },
    {
      title: 'Total Responses',
      value: stats?.total_responses,
      icon: GraduationCap,
      background: 'bg-[#DCE7F2]',
      iconColor: 'text-[#315B62]'
    },
    {
      title: 'Total Courses',
      value: stats?.total_courses,
      icon: ChartNoAxesColumnIncreasing,
      background: 'bg-[#F3E7CF]',
      iconColor: 'text-[#88703D]'
    }
  ];

  if (loading) {
    return <p className="text-[#4B5545]">Loading dashboard...</p>;
  }

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  return (
    <div>

      {/* Dashboard Header - Outside Main Container */}
      <div className="relative -mx-8 -mt-8 h-[158px]">

        <div className="absolute inset-x-0 -top-20 bottom-0 overflow-hidden">
          <img
            src={dashboardBg}
            alt="University building"
            className="absolute inset-0 h-full w-full object-cover object-[center_38%] opacity-50"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-[#F4F7F6] via-[#F4F7F6]/85 to-[#F4F7F6]/15" />
        </div>

        <div className="relative z-10 flex h-full -translate-y-4 flex-col justify-center px-8">
          <h1 className="text-3xl font-bold text-[#263D32]">
            Admin Dashboard
          </h1>

          <p className="mt-2 text-sm text-[#35483D]">
            Monitor surveys, track responses, and manage course feedback efficiently.
          </p>
        </div>

      </div>

      {/* Main Dashboard Container */}
      <div className="relative isolate -mx-8 -mt-12 w-auto overflow-hidden rounded-t-[48px] rounded-b-none border border-[#E5E8E3] bg-white px-8 py-7 shadow-sm">


        <div className="relative z-10 space-y-7">

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">

            {statCards.map((card) => {
              const Icon = card.icon;

              return (
                <div
                  key={card.title}
                  className={`${card.background} relative isolate overflow-hidden rounded-2xl p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md`}
                >

                  {/* Decorative Waves */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2 overflow-hidden">
                    <svg
                      viewBox="0 0 400 120"
                      preserveAspectRatio="none"
                      className="h-full w-full"
                    >
                      <path
                        d="M0 45 C90 5 130 110 230 65 C300 30 340 35 400 5 L400 120 L0 120 Z"
                        fill="white"
                        opacity="0.22"
                      />

                      <path
                        d="M0 85 C100 45 150 115 250 80 C320 55 350 65 400 35 L400 120 L0 120 Z"
                        fill="white"
                        opacity="0.3"
                      />
                    </svg>
                  </div>

                  {/* Card Content */}
                  <div className="relative flex items-center gap-4">
                    <div className={`rounded-xl bg-white/50 p-3 ${card.iconColor}`}>
                      <Icon size={30} strokeWidth={1.8} />
                    </div>

                    <p className="text-base font-semibold text-[#263D32]">
                      {card.title}
                    </p>
                  </div>

                  <h2 className="relative mt-5 text-4xl font-bold text-[#263D32]">
                    {card.value ?? 0}
                  </h2>

                </div>
              );
            })}

          </div>

          {/* Analytics Charts */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

            <ResponseTrendChart data={responseTrend} />

            <SurveyStatusChart data={surveyStatus} />

          </div>

          {/* Recent Surveys and Quick Actions */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

            <div className="xl:col-span-2">
              <RecentSurveysTable data={recentSurveys} />
            </div>

            <div>
              <QuickActions />
            </div>

          </div>

        </div>
      </div>

    </div>
  );
}

export default Dashboard;
