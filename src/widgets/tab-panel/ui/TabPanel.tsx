import { AnimatePresence } from 'motion/react';
import { Route, Switch, useRoute } from 'wouter';
import { useTab } from '@/features/manage-tabs';
import { Search } from '@/features/search';
import { Animated } from '@/shared/ui/Animated';
import { Button } from '@/shared/ui/Button';
import { ProjectPageActions } from './ProjectPageActions';
import { ProjectsPageActions } from './ProjectsPageActions';

export const TabPanel = () => {
  const { tab, goBack, goForward } = useTab();

  const [location] = tab.location.split('?');
  const [isProjectsRoute] = useRoute('/projects');
  const [isProjectRoute] = useRoute('/project/:projectId');
  const [isSourceRoute] = useRoute('/source/:sourceId');
  const isSearchRoute = isProjectsRoute || isProjectRoute || isSourceRoute;
  const animatedKey = isSearchRoute ? 'static-key' : location;

  const canGoBack = (tab?.history?.length || 0) > 1;
  const canGoForward = (tab?.future?.length || 0) > 0;

  return (
    <div className="flex shrink-0 items-center gap-3 px-2 py-1 pt-0.5">
      <div className="flex w-50 shrink items-center gap-1">
        <Button
          iconId="back"
          iconSize={22}
          isDisabled={!canGoBack}
          tooltip="Go Back"
          tooltipPosition="bottom"
          onClick={goBack}
        />
        <Button
          iconId="forward"
          iconSize={22}
          isDisabled={!canGoForward}
          tooltip="Go Forward"
          tooltipPosition="bottom"
          onClick={goForward}
        />
      </div>
      <div className="mx-auto min-w-126 max-w-200 grow">
        <AnimatePresence mode="wait" initial={false}>
          <Animated key={animatedKey} ease="linear">
            <Switch location={location}>
              <Route path="/projects">
                <Search placeholder="Search in all projects..." />
              </Route>
              <Route path="/project/:projectId">
                {({ projectId }) => (
                  <Search
                    placeholder="Search in this project..."
                    filters={{ projectIds: [projectId] }}
                  />
                )}
              </Route>
              <Route path="/source/:sourceId">
                {({ sourceId }) => (
                  <Search
                    placeholder="Search in this source..."
                    filters={{ sourceIds: [sourceId] }}
                  />
                )}
              </Route>
            </Switch>
          </Animated>
        </AnimatePresence>
      </div>
      <div className="flex w-50 shrink items-center justify-end gap-2">
        <AnimatePresence mode="wait" initial={false}>
          <Animated key={location} ease="linear">
            <Switch location={location}>
              <Route key="projects" path="/projects">
                <ProjectsPageActions />
              </Route>
              <Route key="project" path="/project/:projectId">
                {({ projectId }) => <ProjectPageActions projectId={projectId} />}
              </Route>
            </Switch>
          </Animated>
        </AnimatePresence>
      </div>
    </div>
  );
};
