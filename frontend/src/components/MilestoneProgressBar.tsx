type MilestoneProgressBarProps = {
  completed: number;
  total: number;
};

function clampProgress(completed: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  const ratio = completed / total;
  return Math.max(0, Math.min(100, ratio * 100));
}

export function MilestoneProgressBar({ completed, total }: MilestoneProgressBarProps) {
  const progress = clampProgress(completed, total);

  return (
    <div className="progress-block">
      <div className="progress-copy-row">
        <span>Milestones</span>
        <strong>
          {completed}/{total}
        </strong>
      </div>
      <div aria-hidden="true" className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
