import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { getCompletedTourIds } from './tutorial-progress';
import { TUTORIAL_MODULES } from './tours';

export function TutorialLauncher() {
  const completed = new Set(getCompletedTourIds());
  const incomplete = TUTORIAL_MODULES.length - completed.size;

  return (
    <Button variant="outline" size="sm" asChild>
      <Link to="/tutorials">
        Tutorials
        {incomplete > 0 ? (
          <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
            {incomplete}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
