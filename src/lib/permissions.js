export const ROLES = {
  ADMIN: "admin",
  PROSPECTEUR: "prospecteur",
  COMMERCIAL: "commercial",
};

export const canViewPipeline = (user, pipeline) => {
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true;
  if (pipeline.visibility === "public") return true;
  return pipeline.ownerId === user.id;
};

export const canEditPipeline = (user, pipeline) => {
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true;
  return pipeline.ownerId === user.id;
};

export const canEditCard = (user, card, pipeline) => {
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true;
  if (card.responsibleId === user.id) return true;
  if (pipeline.ownerId === user.id) return true;
  return false;
};

export const canDeleteCard = (user, card, pipeline) => {
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true;
  if (card.responsibleId === user.id) return true;
  if (pipeline.ownerId === user.id) return true;
  return false;
};

export const canDeleteContact = (user, contact) => {
  if (!user) return false;
  if (user.role === ROLES.ADMIN) return true;
  return contact.createdBy === user.id;
};

export const canViewUserAgenda = (currentUser, targetUser) => {
  if (!currentUser || !targetUser) return false;
  if (currentUser.role === ROLES.ADMIN) return true;
  if (currentUser.id === targetUser.id) return true;
  if (currentUser.role === ROLES.PROSPECTEUR && targetUser.role === ROLES.COMMERCIAL) {
    return targetUser.settings?.shareAgendaWithProspectors === true;
  }
  return false;
};
