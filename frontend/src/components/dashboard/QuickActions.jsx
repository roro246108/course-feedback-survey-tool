import { useNavigate } from 'react-router-dom';
import { Plus, ClipboardList, FileQuestion } from 'lucide-react';

function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    {
      title: 'Create Survey',
      description: 'Create a new course feedback survey',
      icon: Plus,
      path: '/admin/surveys/create',
    },
    {
      title: 'Manage Surveys',
      description: 'View and manage existing surveys',
      icon: ClipboardList,
      path: '/admin/surveys',
    },
    {
      title: 'Manage Questions',
      description: 'Manage survey questions',
      icon: FileQuestion,
      path: '/admin/questions',
    },
  ];

  return (
    <div className="rounded-xl border border-[#E5E8E3] bg-white p-6 shadow-sm">

      <h2 className="text-lg font-semibold text-[#2B5748]">
        Quick Actions
      </h2>

      <p className="mt-1 text-sm text-[#899187]">
        Quickly access common admin tasks
      </p>

      <div className="mt-5 flex flex-col gap-3">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.title}
              onClick={() => navigate(action.path)}
              className="flex items-center gap-4 rounded-lg border border-[#E5E8E3] p-4 text-left transition hover:bg-[#F4F7F6]"
            >
              <div className="rounded-lg bg-[#E8EFE9] p-3">
                <Icon size={22} className="text-[#2B5748]" />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-[#2B5748]">
                  {action.title}
                </h3>

                <p className="mt-1 text-xs text-[#899187]">
                  {action.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
}

export default QuickActions;