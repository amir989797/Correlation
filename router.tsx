
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

export function Link({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  const { navigate } = useRouter();
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}

export function Router({ children }: { children: ReactNode }) {
  // Always initialize to Home Page ('/') regardless of current URL
  const [path, setPath] = useState('/');

  useEffect(() => {
    // Sync browser URL bar with the forced Home state on mount
    // Wrapped in try-catch to prevent SecurityError in sandboxed environments (e.g. iframe)
    try {
      if (window.location.pathname !== '/') {
        window.history.replaceState({}, '', '/');
      }
    } catch (e) {
      console.warn("History API restricted, could not reset URL:", e);
    }

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

export function Routes({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function Route({ path, element }: { path: string; element: ReactNode }) {
  const { path: currentPath } = useRouter();
  return currentPath === path ? <>{element}</> : null;
}
