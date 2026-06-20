import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { isConfigured, isLoading, user } = useAuth();
  const location = useLocation();

  if (!isConfigured) {
    return children;
  }

  if (isLoading) {
    return (
      <main className="plain-page">
        <section className="plain-panel narrow">
          <span className="plain-eyebrow">Account</span>
          <h1>Loading</h1>
          <p>Checking your session.</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  return children;
}
