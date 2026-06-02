import React, { createContext, useContext, useReducer, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/db";
import { toast } from "sonner";
import ICAL from "ical.js";

const AppContext = createContext();

const initialState = {
  currentUser: null,
  loading: true,
  users: [],
  pipelines: [],
  contacts: [],
  contactLists: [],
  tasks: [],
  externalEvents: [],
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
    case "UPDATE_EXTERNAL_EVENTS":
      return { ...state, externalEvents: action.payload };
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

  const fetchExternalCalendar = async (url) => {
    if (!url) {
      dispatch({ type: "UPDATE_EXTERNAL_EVENTS", payload: [] });
      return;
    }

    try {
      const response = await fetch(url);
      const data = await response.text();
      const jcalData = ICAL.parse(data);
      const comp = new ICAL.Component(jcalData);
      const vevents = comp.getAllSubcomponents('vevent');
      
      const mappedEvents = vevents.map(veventComp => {
        const event = new ICAL.Event(veventComp);
        const startDate = event.startDate.toJSDate();
        
        return {
          id: event.uid,
          title: event.summary,
          description: event.description,
          dueDate: startDate.toISOString(),
          date: startDate.toISOString().split('T')[0],
          time: `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`,
          type: 'google',
          status: 'external'
        };
      });
        
      dispatch({ type: "UPDATE_EXTERNAL_EVENTS", payload: mappedEvents });
    } catch (error) {
      console.warn("Could not fetch external calendar:", error);
    }
  };

  const refreshAllData = async () => {
    try {
      const currentUserId = state.currentUser?.id;
      const [users, pipelines, contacts, contactLists, tasks, rdvProposals, notifications] = await Promise.all([
        db.getProfiles(),
        db.getPipelines(),
        db.getContacts(),
        db.getContactLists(),
        db.getTasks(),
        db.getProposals(),
        currentUserId ? db.getNotifications(currentUserId) : Promise.resolve([])
      ]);

      if (state.currentUser?.settings?.calendarUrl) {
        fetchExternalCalendar(state.currentUser.settings.calendarUrl);
      }

      dispatch({
        type: "INIT_DATA",
        payload: {
          users,
          pipelines,
          contacts,
          contactLists,
          tasks,
          rdvProposals,
          notifications
        }
      });
    } catch (error) {
      console.error("Error loading data from Supabase:", error);
      toast.error("Erreur lors de la synchronisation");
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  // Initial load
  useEffect(() => {
    const initApp = async () => {
      dispatch({ type: "SET_LOADING", payload: true });
      
      // Check for session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        try {
          const profileData = await db.getProfiles();
          const profile = profileData.find(p => p.id === session.user.id);
          
          if (profile) {
            dispatch({ type: "SET_CURRENT_USER", payload: profile });
            
            if (profile.settings?.calendarUrl) {
              fetchExternalCalendar(profile.settings.calendarUrl);
            }

            if (profile.isApproved) {
              const [pipelines, contacts, contactLists, tasks, rdvProposals, notifications] = await Promise.all([
                db.getPipelines(),
                db.getContacts(),
                db.getContactLists(),
                db.getTasks(),
                db.getProposals(),
                db.getNotifications(profile.id)
              ]);

              dispatch({
                type: "INIT_DATA",
                payload: {
                  users: profileData,
                  pipelines,
                  contacts,
                  contactLists,
                  tasks,
                  rdvProposals,
                  notifications
                }
              });
            } else {
              dispatch({ type: "UPDATE_USERS", payload: profileData });
              dispatch({ type: "SET_LOADING", payload: false });
            }
          } else {
            dispatch({ type: "SET_LOADING", payload: false });
          }
        } catch (error) {
          console.error("Initial load error:", error);
          dispatch({ type: "SET_LOADING", payload: false });
        }
      } else {
        dispatch({ type: "SET_LOADING", payload: false });
      }

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          const profileData = await db.getProfiles();
          const profile = profileData.find(p => p.id === session.user.id);
          
          if (profile) {
            dispatch({ type: "SET_CURRENT_USER", payload: profile });
            
            if (profile.settings?.calendarUrl) {
              fetchExternalCalendar(profile.settings.calendarUrl);
            }

            if (profile.isApproved) {
              await refreshAllData();
            } else {
              dispatch({ type: "UPDATE_USERS", payload: profileData });
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
