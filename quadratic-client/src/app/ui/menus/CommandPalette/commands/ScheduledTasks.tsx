import type { CommandGroup } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { CREATE_TASK_ID, useScheduledTasks } from '@/jotai/scheduledTasksAtom';
import { ScheduledTasksIcon } from '@/shared/components/Icons';

const commands: CommandGroup = {
  heading: 'Scheduled Tasks',
  commands: [
    {
      label: 'Show scheduled tasks',
      keywords: ['scheduled', 'tasks', 'cron', 'automation', 'timer'],
      isAvailable: ({ teamPermissions }) => teamPermissions?.includes('TEAM_VIEW') ?? false,
      Component: (props) => {
        const { showScheduledTasks } = useScheduledTasks();
        return <CommandPaletteListItem {...props} icon={<ScheduledTasksIcon />} action={() => showScheduledTasks()} />;
      },
    },
    {
      label: 'Create new scheduled task',
      keywords: ['new', 'create', 'scheduled', 'task', 'cron', 'automation'],
      isAvailable: ({ teamPermissions }) => teamPermissions?.includes('TEAM_EDIT') ?? false,
      Component: (props) => {
        const { showScheduledTasks } = useScheduledTasks();
        return (
          <CommandPaletteListItem
            {...props}
            icon={<ScheduledTasksIcon />}
            action={() => showScheduledTasks(CREATE_TASK_ID)}
          />
        );
      },
    },
  ],
};

export default commands;
