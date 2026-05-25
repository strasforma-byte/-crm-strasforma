import React from "react";
import { AppProvider, useApp } from "./context/AppContext";
import AuthScreen from "./components/AuthScreen";
import Layout from "./components/Layout";
import { Skeleton } from "./components/ui/skeleton";
import { Button } from "./components/ui/button";
import { Clock } from "lucide-react";
import { supabase } from "./lib/supabase";

function AppContent() {
  const { state } = useApp();
  
  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-12 w-12 rounded-xl mx-auto" />
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!state.currentUser) {
    return <AuthScreen />;
  }

  if (!state.currentUser.isApproved) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="bg-amber-100 text-amber-600 p-4 rounded-full mb-6 shadow-sm">
          <Clock className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Compte en attente</h1>
        <p className="text-slate-500 max-w-md mb-8">
          Votre compte a été créé avec succès, mais il doit être validé par l'administrateur (ismail.harrouchi@strasforma.fr) avant que vous ne puissiez accéder au CRM.
        </p>
        <Button variant="outline" onClick={() => supabase.auth.signOut()}>
          Se déconnecter
        </Button>
      </div>
    );
  }

  return <Layout />;
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
