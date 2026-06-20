import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { driver, type DriveStep, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { getTourById, type ModuleTour } from './tours';
import { markTourCompleted } from './tutorial-progress';

type TutorialContextValue = {
  startTour: (moduleId: string) => void;
  activeTourId: string | null;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

function waitForElement(selector: string, timeoutMs = 8000): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      const el = document.querySelector(selector);
      if (el || Date.now() - started > timeoutMs) {
        window.clearInterval(timer);
        resolve(el);
      }
    }, 100);
  });
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const driverRef = useRef<Driver | null>(null);
  const activeTourIdRef = useRef<string | null>(null);

  const startTour = useCallback(
    async (moduleId: string) => {
      const tour = getTourById(moduleId);
      if (!tour) return;

      driverRef.current?.destroy();
      activeTourIdRef.current = moduleId;

      const firstRoute = tour.steps[0]?.route ?? tour.startRoute;
      navigate(firstRoute);
      await waitForElement(tour.steps[0]?.element ?? '[data-tour="main-content"]');

      const steps: DriveStep[] = tour.steps.map((step) => ({
        element: step.element,
        popover: {
          title: step.title,
          description: step.description,
          side: 'bottom' as const,
          align: 'start' as const,
        },
      }));

      const instance = driver({
        showProgress: true,
        animate: true,
        overlayOpacity: 0.55,
        steps,
        onHighlightStarted: (_element, _step, { state }) => {
          const idx = state.activeIndex ?? 0;
          const tourStep = tour.steps[idx];
          if (tourStep?.route) {
            navigate(tourStep.route);
          }
        },
        onDestroyed: () => {
          markTourCompleted(moduleId);
          activeTourIdRef.current = null;
        },
      });

      driverRef.current = instance;
      instance.drive();
    },
    [navigate],
  );

  const value = useMemo<TutorialContextValue>(
    () => ({
      startTour,
      activeTourId: activeTourIdRef.current,
    }),
    [startTour],
  );

  return (
    <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>
  );
}

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error('useTutorial must be used within TutorialProvider');
  }
  return ctx;
}

export type { ModuleTour };
