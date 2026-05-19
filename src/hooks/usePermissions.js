import { useApp } from "@/context/AppContext";
import * as permissions from "@/lib/permissions";

export function usePermissions() {
  const { state } = useApp();
  const user = state.currentUser;

  return {
    canViewPipeline: (pipeline) => permissions.canViewPipeline(user, pipeline),
    canEditPipeline: (pipeline) => permissions.canEditPipeline(user, pipeline),
    canEditCard: (card, pipeline) => permissions.canEditCard(user, card, pipeline),
    canDeleteCard: (card, pipeline) => permissions.canDeleteCard(user, card, pipeline),
    canDeleteContact: (contact) => permissions.canDeleteContact(user, contact),
    canViewUserAgenda: (targetUser) => permissions.canViewUserAgenda(user, targetUser),
    isAdmin: user?.role === "admin",
    isProspecteur: user?.role === "prospecteur",
    isCommercial: user?.role === "commercial",
    currentUser: user,
  };
}
