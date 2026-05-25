import React, { createContext, useContext, useReducer, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/db";
import { toast } from "sonner";

const AppContext = createContext();

const initialState = {
  currentUser: null,
  loading: true,
  users: [],
  pipelines: [],
  contacts: [],
  contactLists: [],
  tasks: [],
  rdvProposals: [],
  notifications: [],
};

function appReducer(state, action) {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "INIT_DATA":
      return { ...state, ...action.payload, loading: false };
    case "SET_CURRENT_USER":
      return { ...state, currentUser: action.payload };
    case "UPDATE_USERS":
      return { ...state, users: action.payload };
    case "UPDATE_PIPELINES":
      return { ...state, pipelines: action.payload };
    case "UPDATE_CONTACTS":
      return { ...state, contacts: action.payload };
    case "UPDATE_CONTACT_LISTS":
      return { ...state, contactLists: action.payload };
    case "UPDATE_TASKS":
      return { ...state, tasks: action.payload };
    case "UPDATE_PROPOSALS":
      return { ...state, rdvProposals: action.payload };
    case "UPDATE_NOTIFICATIONS":
      return { ...state, notifications: action.payload };
    case "LOGOUT":
      return { ...initialState, loading: false };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const refreshAllData = async () => {
    try {
      const [users, pipelines, contacts, contactLists, tasks, rdvProposals] = await Promise.all([
        db.getProfiles(),
        db.getPipelines(),
        db.getContacts(),
        db.getContactLists(),
        db.getTasks(),
        db.getProposals()
      ]);

      dispatch({
        type: "INIT_DATA",
        payload: {
          users,
          pipelines,
          contacts,
          contactLists,
          tasks,
          rdvProposals
        }
      });
    } catch (error) {
      console.error("Error loading data from Supabase:", error);
      toast.error("Erreur lors du chargement des données");
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  // Initial load
  useEffect(() => {
    const initApp = async () => {
      dispatch({ type: "SET_LOADING", payload: true });
      
      // Check for Supabase configuration
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        toast.error("Configuration Supabase manquante !", {
          description: "Les variables d'environnement VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY ne sont pas définies.",
          duration: 10000,
        });
      }

      // Check for session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Fetch profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profile) {
          dispatch({ type: "SET_CURRENT_USER", payload: profile });
          if (profile.is_approved) {
            await refreshAllData();
          } else {
            dispatch({ type: "SET_LOADING", payload: false });
          }
        }
      } else {
        dispatch({ type: "SET_LOADING", payload: false });
      }

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (profile) {
            dispatch({ type: "SET_CURRENT_USER", payload: profile });
            if (profile.is_approved) {
              await refreshAllData();
            } else {
              dispatch({ type: "SET_LOADING", payload: false });
            }
          }
        } else if (event === 'SIGNED_OUT') {
          dispatch({ type: "LOGOUT" });
        }
      });

      return () => subscription.unsubscribe();
    };

    initApp();
  }, []);

  const value = {
    state,
    dispatch,
    refreshAllData,
    isAdmin: state.currentUser?.role === "admin",
    isProspecteur: state.currentUser?.role === "prospecteur",
    isCommercial: state.currentUser?.role === "commercial",
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
