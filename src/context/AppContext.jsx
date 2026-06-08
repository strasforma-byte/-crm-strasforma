import React, { createContext, useContext, useReducer, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/db";
import { toast } from "sonner";
import * as ICAL from "ical.js";

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
      return { ...state, pipelines: typeof action.payload === 'function' ? action.payload(state.pipelines) : action.payload };
    case "UPDATE_CONTACTS":
      return { ...state, contacts: typeof action.payload === 'function' ? action.payload(state.contacts) : action.payload };
    case "UPDATE_CONTACT_LISTS":
      return { ...state, contactLists: action.payload };
    case "UPDATE_TASKS":
      return { ...state, tasks: action.payload };
    case "UPDATE_EXTERNAL_EVENTS":
      return { ...state, externalEvents: action.payload };
    case "IMPORT_ICAL_DATA":
      try {
        const jcalData = ICAL.parse(action.payload);
        const comp = new ICAL.Component(jcalData);
        const vevents = comp.getAllSubcomponents('vevent');
        
        const mappedEvents = vevents.map(veventComp => {
          try {
            const event = new ICAL.Event(veventComp);
            if (!event.startDate) return null;
            const startDate = event.startDate.toJSDate();
            
            return {
              id: event.uid || Math.random().toString(36).substr(2, 9),
              title: "🗓️ " + (event.summary || "Occupation Google"),
              description: event.description || "",
              dueDate: startDate.toISOString(),
              date: startDate.toISOString().split('T')[0],
              time: `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`,
              type: 'google',
              userId: state.currentUser?.id,
              status: 'external'
            };
          } catch (e) { return null; }
        }).filter(Boolean);

        // Save to local storage for persistence
        localStorage.setItem(`paff_external_cal_${state.currentUser?.id}`, JSON.stringify(mappedEvents));
        return { ...state, externalEvents: mappedEvents };
      } catch (error) {
        console.error("Import error:", error);
        return state;
      }
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
      console.log("No calendar URL provided, clearing external events.");
      dispatch({ type: "UPDATE_EXTERNAL_EVENTS", payload: [] });
      return;
    }

    try {
      console.log("--- GOOGLE CALENDAR SYNC START ---");
      console.log("Original URL:", url);
      
      // Attempting with a different proxy service: AllOrigins
      // Adding a timestamp to bypass proxy caching
      const timestamp = new Date().getTime();
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url.trim() + (url.includes('?') ? '&' : '?') + 't=' + timestamp)}`;
      
      console.log("Fetching via AllOrigins proxy...");

      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const json = await response.json();
      const data = json.contents;

      console.log("Data length received:", data?.length || 0);
      
      if (!data || !data.includes("BEGIN:VCALENDAR")) {
        console.error("Data received is not a valid iCalendar file:", data.substring(0, 200));
        throw new Error("Format iCal invalide");
      }
      
      if (!ICAL || typeof ICAL.parse !== 'function') {
        console.error("ICAL library not properly loaded");
        throw new Error("Erreur système (Calendrier)");
      }

      const jcalData = ICAL.parse(data);
      const comp = new ICAL.Component(jcalData);
      const vevents = comp.getAllSubcomponents('vevent');
      console.log(`Successfully parsed ${vevents.length} events`);
      
      const mappedEvents = vevents.map(veventComp => {
        try {
          const event = new ICAL.Event(veventComp);
          if (!event.startDate) return null;
          
          const startDate = event.startDate.toJSDate();
          const endDate = event.endDate ? event.endDate.toJSDate() : new Date(startDate.getTime() + 30 * 60000);
          
          return {
            id: event.uid || Math.random().toString(36).substr(2, 9),
            title: "🗓️ " + (event.summary || "Occupation Google"),
            description: event.description || "",
            dueDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            date: startDate.toISOString().split('T')[0],
            time: `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`,
            type: 'google',
            userId: state.currentUser?.id,
            status: 'external'
          };
        } catch (e) {
          console.warn("Error parsing individual event:", e);
          return null;
        }
      }).filter(Boolean);
        
      console.log("Sample mapped event:", mappedEvents[0]);
      console.log("--- GOOGLE CALENDAR SYNC SUCCESS ---");
      dispatch({ type: "UPDATE_EXTERNAL_EVENTS", payload: mappedEvents });
    } catch (error) {
      console.error("--- GOOGLE CALENDAR SYNC ERROR ---");
      console.error(error);
      toast.error("Impossible de charger l'agenda Google : " + error.message);
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
            
            const savedEvents = localStorage.getItem(`paff_external_cal_${profile.id}`);
            if (savedEvents) {
              try {
                dispatch({ type: "UPDATE_EXTERNAL_EVENTS", payload: JSON.parse(savedEvents) });
              } catch (e) { }
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
            
            const savedEvents = localStorage.getItem(`paff_external_cal_${profile.id}`);
            if (savedEvents) {
              try {
                dispatch({ type: "UPDATE_EXTERNAL_EVENTS", payload: JSON.parse(savedEvents) });
              } catch (e) { }
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
