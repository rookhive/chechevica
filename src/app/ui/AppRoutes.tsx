import { AnimatePresence } from 'motion/react';
import { Suspense, startTransition, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Route, Switch, useLocation, useSearchParams } from 'wouter';
import { useTab } from '@/features/manage-tabs';
import { NewTabPage } from '@/pages/new-tab';
import { NotFoundPage } from '@/pages/not-found';
import { ProcessingSourcesPage } from '@/pages/processing-sources';
import { ProjectPage } from '@/pages/project';
import { ProjectsPage } from '@/pages/projects';
import { SettingsPage } from '@/pages/settings';
import { SourcePage } from '@/pages/source';
import { Animated } from '@/shared/ui/Animated';
import { Spinner } from '@/shared/ui/Spinner';
import { StatusMessage } from '@/shared/ui/StatusMessage';

export const AppRoutes = () => {
  const [location] = useLocation();
  const [searchParams] = useSearchParams();
  const searchKey = searchParams.toString();

  return (
    <ErrorBoundary fallback={<FatalErrorMessage />} resetKeys={[location, searchKey]}>
      <Suspense fallback={<Loader />}>
        <AnimatePresence mode="wait">
          <Animated key={location} className="h-full min-h-0" duration={0.25} ease="linear">
            <TabLoadingSync />
            <Switch location={location}>
              <Route path="/new" component={NewTabPage} />
              <Route path="/settings" component={SettingsPage} />
              <Route path="/processing-sources" component={ProcessingSourcesPage} />
              <Route path="/projects" component={ProjectsPage} />
              <Route path="/project/:projectId" component={ProjectPage} />
              <Route path="/source/:sourceId" component={SourcePage} />
              <Route component={NotFoundPage} />
            </Switch>
          </Animated>
        </AnimatePresence>
      </Suspense>
    </ErrorBoundary>
  );
};

const FatalErrorMessage = () => {
  const { setIsLoading, setTitle, setIcon } = useTab();

  setIcon('error');
  setTitle('Error..');

  useEffect(() => {
    startTransition(() => {
      setIsLoading(false);
    });
  }, [setIsLoading]);

  return (
    <StatusMessage className="-mt-4" status="dangerous" iconId="error">
      Something went wrong :(
    </StatusMessage>
  );
};

const TabLoadingSync = () => {
  const { setIsLoading } = useTab();

  useEffect(() => {
    startTransition(() => {
      setIsLoading(false);
    });
  }, [setIsLoading]);

  return null;
};

const Loader = () => {
  const { setIsLoading } = useTab();

  useEffect(() => {
    startTransition(() => {
      setIsLoading(true);
    });
  }, [setIsLoading]);

  return <Spinner className="text-emerald-700" size={28} absoluteCentered />;
};
