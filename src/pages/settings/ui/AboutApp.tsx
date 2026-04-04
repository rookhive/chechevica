import { getIdentifier, getName, getVersion } from '@tauri-apps/api/app';
import { useEffect, useState } from 'react';

type AppInfo = {
  name: string;
  version: string;
  identifier: string;
};

export const AboutApp = () => {
  const [appInfo, setAppInfo] = useState<AppInfo>({ name: '', version: '', identifier: '' });

  useEffect(() => {
    (async function fetchVersion() {
      setAppInfo(
        await Promise.all([getName(), getVersion(), getIdentifier()]).then(
          ([name, version, identifier]) => ({
            name,
            version,
            identifier,
          })
        )
      );
    })();
  }, []);

  return (
    <ul className="flex flex-col gap-1.5">
      {Object.entries(appInfo).map(([key, value]) => (
        <li key={key} className="flex text-sm">
          <span className="w-20 text-neutral-500 capitalize">{key}</span>
          <span className="text-neutral-300">{value}</span>
        </li>
      ))}
    </ul>
  );
};
