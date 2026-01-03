
import React, { useState, useEffect, useContext, createContext, ReactNode } from 'react';

const RouterContext = createContext<{ path: string; navigate: (path: string) => void }>({
  path: '/',
  navigate: () => {},
});

export function useRouter() {
  return useContext(RouterContext);
}

export function useLocation() {
  const { path } = useRouter();
  return { pathname: path };
}

export function Link({ to, children, className, target }: { to: string; children?: ReactNode; className?: string; target?: string }) {
  const { navigate } = useRouter();
  
  const handleClick = (e: React.MouseEvent) => {
    // If it's an external link or has a target, let the browser handle it
    if (to.startsWith('http') || target) {
        return;
    }
    e.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} className={className} target={target}>
      {children}
    </a>
  );
}

export function Router({ children }: { children?: ReactNode }) {
  // Initialize with current browser path instead of forcing '/'
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => {
      try {
        setPath(window.location.pathname);
      } catch {
        // Ignore errors
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (newPath: string) => {
    try {
      window.history.pushState({}, '', newPath);
    } catch (e) {
      console.warn("Navigation state update failed. UI will still update.");
    }
    setPath(newPath);
    window.scrollTo(0, 0);
  };

  return (
    <RouterContext.Provider value={{ path, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function Routes({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function Route({ path, element }: { path: string; element: ReactNode }) {
  const { path: currentPath } = useRouter();
  return currentPath === path ? <>{element}</> : null;
}
