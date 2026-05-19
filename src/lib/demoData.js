import { addDays, subDays, startOfToday, format } from "date-fns";

export const generateDemoData = () => {
  const today = startOfToday();

  const users = [
    { id: "u1", name: "Marie", email: "marie@strasforma.fr", role: "admin", color: "#ef4444", settings: { shareAgendaWithProspectors: false } },
    { id: "u2", name: "Thomas", email: "thomas@strasforma.fr", role: "commercial", color: "#3b82f6", settings: { shareAgendaWithProspectors: true } },
    { id: "u3", name: "Sophie", email: "sophie@strasforma.fr", role: "prospecteur", color: "#a855f7", settings: { shareAgendaWithProspectors: false } },
    { id: "u4", name: "Lucas", email: "lucas@strasforma.fr", role: "commercial", color: "#22c55e", settings: { shareAgendaWithProspectors: false } },
  ];

  const contactLists = [
    { id: "list-default", name: "Tous les contacts", color: "#16a34a", icon: "folder" },
    { id: "list-idf", name: "Prospection Ile-de-France", color: "#3b82f6", icon: "file-text" },
    { id: "list-grands-comptes", name: "Grands Comptes", color: "#a855f7", icon: "file-text" }
  ];

  const firstNames = ["Jean", "Pierre", "Paul", "Marie", "Sophie", "Alice", "Thomas", "Lucas", "Emma", "Nicolas", "Julie", "Marc", "Antoine", "Lea", "Sarah"];
  const lastNames = ["Dupont", "Martin", "Leroy", "Bernard", "Petit", "Moreau", "Roux", "Lefebvre", "Garcia", "Fournier", "Muller", "Lambert", "Faure", "Perez"];
  const sectors = ["Tech", "Immobilier", "Retail", "Santé", "Finance", "BTP", "Conseil"];

  const generateBulkContacts = (listId, count) => {
    const listContacts = [];
    for (let i = 1; i <= count; i++) {
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
      listContacts.push({
        id: `c-${listId}-${i}`,
        createdBy: "u1",
        listId: listId,
        firstName: fn,
        lastName: ln,
        company: `${ln} ${["SAS", "SARL", "EURL"][Math.floor(Math.random() * 3)]}`,
        phone: `06 ${Math.floor(10 + Math.random() * 89)} ${Math.floor(10 + Math.random() * 89)} ${Math.floor(10 + Math.random() * 89)} ${Math.floor(10 + Math.random() * 89)}`,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}@entreprise${i}.fr`,
        tags: [["prospect", "client", "partenaire"][Math.floor(Math.random() * 3)]],
        notes: i % 5 === 0 ? "Note importante de suivi." : "",
        industry: sectors[Math.floor(Math.random() * sectors.length)],
        assignedAgentId: users[Math.floor(Math.random() * users.length)].id,
        interactions: [],
        createdAt: subDays(today, Math.floor(Math.random() * 30)).toISOString(),
        lastModified: subDays(today, Math.floor(Math.random() * 5)).toISOString()
      });
    }
    return listContacts;
  };

  const contacts = [
    ...generateBulkContacts("list-idf", 60),
    ...generateBulkContacts("list-grands-comptes", 60)
  ];

  const defaultColumns = [
    { id: "col1", name: "Nouveau Lead", order: 0 },
    { id: "col2", name: "Qualifié", order: 1 },
    { id: "col3", name: "Proposition", order: 2 },
    { id: "col4", name: "Gagné ✅", order: 3 },
    { id: "col5", name: "Perdu ❌", order: 4 },
  ];

  const pipelines = [
    { id: "p1", name: "Ventes 2025", ownerId: "u1", visibility: "public", columns: defaultColumns.map(col => ({ ...col, cards: [] })) }
  ];

  const tasks = [];
  const rdvProposals = [];
  const notifications = [];

  return { users, pipelines, contacts, contactLists, tasks, rdvProposals, notifications };
};
