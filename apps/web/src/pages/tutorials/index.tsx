import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useTutorial } from '../../features/tutorial/tutorial-provider';
import {
  getCompletedTourIds,
  isTourCompleted,
  resetTutorialProgress,
} from '../../features/tutorial/tutorial-progress';
import { TUTORIAL_MODULES } from '../../features/tutorial/tours';

export function TutorialsPage() {
  const { startTour } = useTutorial();
  const completedCount = getCompletedTourIds().length;

  return (
    <div className="space-y-6" data-tour="tutorials-hub">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Interactive tutorials</h1>
          <p className="text-sm text-muted-foreground">
            Guided tours for all 14 modules using demo seed data. {completedCount}/
            {TUTORIAL_MODULES.length} completed.
          </p>
        </div>
        <Button variant="outline" onClick={() => resetTutorialProgress()}>
          Reset progress
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TUTORIAL_MODULES.map((tour) => {
          const done = isTourCompleted(tour.id);
          return (
            <Card key={tour.id}>
              <CardHeader>
                <CardTitle className="text-lg">{tour.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{tour.description}</p>
                {tour.demoEntityHint ? (
                  <p className="text-xs text-muted-foreground">
                    Demo data: {tour.demoEntityHint}
                  </p>
                ) : null}
                <p className="text-xs">Login: {tour.suggestedLogin}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => startTour(tour.id)}>
                    {done ? 'Replay tour' : 'Start tour'}
                  </Button>
                  {done ? (
                    <span className="self-center text-xs text-green-700">Completed</span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        Markdown guides:{' '}
        <a
          className="underline"
          href="https://github.com/icors2/BusinessSuite/tree/demo/docs/training"
          target="_blank"
          rel="noreferrer"
        >
          docs/training
        </a>
      </p>
    </div>
  );
}
