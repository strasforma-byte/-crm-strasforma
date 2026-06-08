import { supabase } from './supabase'

// Mapping helpers
const mapContact = (c) => {
  if (!c) return null;
  return {
    id: c.id,
    firstName: c.first_name,
    lastName: c.last_name,
    company: c.company,
    siret: c.siret,
    postalCode: c.postal_code,
    phone: c.phone,
    email: c.email,
    industry: c.industry,
    tags: c.tags || [],
    notes: c.notes,
    listId: c.list_id,
    assignedAgentId: c.assigned_agent_id,
    createdBy: c.created_by,
    interactions: c.interactions || [],
    createdAt: c.created_at,
    lastModified: c.last_modified
  };
}

const cleanId = (id) => {
  if (!id || id === "" || id === "none" || id === "null" || id === "undefined") return null;
  return id;
};

const toDbContact = (c) => ({
  first_name: c.firstName,
  last_name: c.lastName,
  company: c.company,
  siret: c.siret,
  postal_code: c.postalCode,
  phone: c.phone,
  email: c.email,
  industry: c.industry,
  tags: Array.isArray(c.tags) ? c.tags : [],
  notes: c.notes,
  list_id: (c.listId === 'list-default' || !c.listId) ? null : c.listId,
  assigned_agent_id: cleanId(c.assignedAgentId),
  created_by: cleanId(c.createdBy),
  interactions: Array.isArray(c.interactions) ? c.interactions : [],
  last_modified: new Date().toISOString()
})

const mapCard = (card) => {
  if (!card) return null;
  let rawNotes = String(card.notes || "");
  let history = [];

  try {
    // Extract history from [history:...] tag. We use a more robust approach to handle nested brackets in JSON.
    // We look for [history: followed by [ ... ] followed by ]
    const historyMatch = rawNotes.match(/\[history:(\[[\s\S]*\])\]/);
    if (historyMatch && historyMatch[1]) {
      try {
        history = JSON.parse(historyMatch[1]);
      } catch (e) {
        console.error("Error parsing history metadata:", e);
      }
    }
  } catch (e) {
    console.error("Error matching history regex:", e);
  }

  // Clean the history tag from the notes. We use the same pattern.
  const cleanNotes = rawNotes.replace(/\[history:\[[\s\S]*\]\]/g, "").trim();

  return {
    id: card.id,
    title: String(card.title || "Sans titre"),
    value: Number(card.value || 0),
    priority: card.priority,
    tags: Array.isArray(card.tags) ? card.tags : [],
    order: Number(card.order || 0),
    contactId: card.contact_id,
    responsibleId: card.responsible_id,
    notes: cleanNotes,
    columnId: card.column_id,
    fundingSource: card.funding_source,
    history: Array.isArray(history) ? history : [],
    createdAt: card.created_at
  };
}

const toDbCard = (card) => {
  // Always clean any existing history tags from notes before appending current history
  // Use a robust regex that handles nested brackets in the JSON history array
  let baseNotes = String(card.notes || "").replace(/\[history:\[[\s\S]*\]\]/g, "").trim();
  let notesWithMeta = baseNotes;
  
  if (card.history && card.history.length > 0) {
    notesWithMeta += `\n[history:${JSON.stringify(card.history)}]`;
  }

  return {
    column_id: cleanId(card.columnId),
    contact_id: cleanId(card.contactId || card.clientId),
    responsible_id: cleanId(card.responsibleId),
    title: card.title,
    value: card.value,
    priority: card.priority,
    funding_source: card.fundingSource,
    tags: card.tags,
    notes: notesWithMeta,
    "order": card.order || 0
  };
}

const mapPipeline = (p) => ({
  id: p.id,
  name: p.name,
  ownerId: p.owner_id,
  visibility: p.visibility,
  columns: p.pipeline_columns ? p.pipeline_columns.map(col => ({
    id: col.id,
    name: col.name,
    order: col.order,
    cards: col.pipeline_cards ? col.pipeline_cards.map(mapCard).filter(Boolean) : []
  })).sort((a, b) => a.order - b.order) : []
})

const mapProposal = (p) => ({
  id: p.id,
  title: p.title,
  prospectorId: p.agent_id,
  commercialId: p.commercial_id,
  contactId: p.contact_id,
  linkedContactId: p.contact_id,
  linkedCardId: p.linked_card_id,
  proposedDate: p.proposed_date,
  proposedSlots: p.proposed_slots || [],
  duration: p.duration,
  notes: p.notes,
  status: p.status,
  refusalReason: p.refusal_reason,
  createdAt: p.created_at
})

const mapProfile = (p) => ({
  id: p.id,
  email: p.email,
  name: p.name,
  role: p.role,
  color: p.color,
  isApproved: p.is_approved,
  settings: p.settings || {},
  createdAt: p.created_at
})

export const db = {
  // Profiles
  async getProfiles() {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map(mapProfile)
  },

  async updateUserProfile(id, updates) {
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', id).select().single()
    if (error) throw error
    return mapProfile(data)
  },

  // Contacts
  async getContacts() {
    const { count, error: countError } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true });
    
    if (countError) throw countError;

    let allData = [];
    const step = 1000;
    const total = count || 0;

    for (let from = 0; from < total; from += step) {
      const to = Math.min(from + step - 1, total - 1);
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .range(from, to)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        allData = [...allData, ...data];
      }
    }

    return allData.map(mapContact);
  },

  async insertContact(contact) {
    try {
      const dbData = toDbContact(contact);
      const { data, error } = await supabase.from('contacts').insert(dbData).select().single()
      if (error) {
        console.error("Supabase insertContact error:", error);
        throw error;
      }
      if (!data) {
        throw new Error("Le serveur n'a pas retourné le contact créé.");
      }
      return mapContact(data)
    } catch (err) {
      console.error("Error in insertContact:", err);
      throw err;
    }
  },

  async bulkInsertContacts(contacts) {
    const CHUNK_SIZE = 100;
    let allInserted = [];
    
    for (let i = 0; i < contacts.length; i += CHUNK_SIZE) {
      const chunk = contacts.slice(i, i + CHUNK_SIZE);
      const { data, error } = await supabase
        .from('contacts')
        .insert(chunk.map(toDbContact))
        .select();
      
      if (error) throw error;
      if (data) {
        allInserted = [...allInserted, ...data.map(mapContact)];
      }
    }
    
    return allInserted;
  },

  async updateContact(id, contact) {
    const { data, error } = await supabase.from('contacts').update(toDbContact(contact)).eq('id', id).select().single()
    if (error) throw error
    return mapContact(data)
  },

  async deleteContact(id) {
    const { error } = await supabase.from('contacts').delete().eq('id', id)
    if (error) throw error
  },

  async bulkDeleteContacts(ids) {
    const CHUNK_SIZE = 100;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from('contacts').delete().in('id', chunk);
      if (error) throw error;
    }
  },

  // Contact Lists
  async getContactLists() {
    const { data, error } = await supabase.from('contact_lists').select('*')
    if (error) throw error
    return data || []
  },

  async insertContactList(list) {
    const { data, error } = await supabase.from('contact_lists').insert(list).select().single()
    if (error) throw error
    return data
  },

  async deleteContactList(id) {
    const { error } = await supabase.from('contact_lists').delete().eq('id', id)
    if (error) throw error
  },

  // Pipelines
  async getPipelines() {
    const { data, error } = await supabase
      .from('pipelines')
      .select(`
        *,
        pipeline_columns (
          *,
          pipeline_cards (*)
        )
      `)
    if (error) throw error
    return (data || []).map(mapPipeline)
  },

  async getPipelineById(id) {
    const { data, error } = await supabase
      .from('pipelines')
      .select(`
        *,
        pipeline_columns (
          *,
          pipeline_cards (*)
        )
      `)
      .eq('id', id)
      .single()
    if (error) throw error
    return mapPipeline(data)
  },

  async insertPipeline(pipeline) {
    const { data: pipeData, error: pipeError } = await supabase.from('pipelines').insert({
      name: pipeline.name,
      owner_id: pipeline.ownerId,
      visibility: pipeline.visibility
    }).select().single()
    
    if (pipeError) throw pipeError

    if (pipeline.columns && pipeline.columns.length > 0) {
      const columnsToInsert = pipeline.columns.map(col => ({
        pipeline_id: pipeData.id,
        name: col.name,
        order: col.order
      }))
      const { error: colError } = await supabase.from('pipeline_columns').insert(columnsToInsert)
      if (colError) throw colError
    }

    return this.getPipelineById(pipeData.id)
  },

  async updatePipeline(id, updates) {
    const { error } = await supabase.from('pipelines').update({
      name: updates.name,
      visibility: updates.visibility
    }).eq('id', id)
    
    if (error) throw error
    
    // If columns are provided, we might need to handle them (complex due to add/remove/update)
    // For now, let's keep it simple or implement a full sync
    return this.getPipelineById(id)
  },

  async deletePipeline(id) {
    const { error } = await supabase.from('pipelines').delete().eq('id', id)
    if (error) throw error
  },

  // Pipeline Columns
  async insertColumn(column) {
    const { data, error } = await supabase.from('pipeline_columns').insert({
      pipeline_id: column.pipelineId,
      name: column.name,
      order: column.order
    }).select().single()
    if (error) throw error
    return data
  },

  async updateColumn(id, updates) {
    const { data, error } = await supabase.from('pipeline_columns').update(updates).eq('id', id).select().single()
    if (error) throw error
    return data
  },

  async deleteColumn(id) {
    const { error } = await supabase.from('pipeline_columns').delete().eq('id', id)
    if (error) throw error
  },

  // Pipeline Cards
  async insertCard(card) {
    const { data, error } = await supabase.from('pipeline_cards').insert(toDbCard(card)).select().single()
    if (error) throw error
    return mapCard(data)
  },

  async updateCard(id, updates) {
    try {
      // 1. Fetch current version for comparison
      const { data: current, error: fetchError } = await supabase.from('pipeline_cards').select('*').eq('id', id).single();
      if (fetchError) throw fetchError;
      const oldCard = mapCard(current);
      if (!oldCard) throw new Error("Affaire non trouvée");

      // 2. Prepare new history entries
      const newHistory = [...(updates.history || oldCard.history || [])];
      const now = new Date().toISOString();
      const userId = cleanId(updates.responsibleId) || oldCard.responsibleId;

      if (updates.title && updates.title !== oldCard.title) {
        newHistory.unshift({ date: now, userId, action: `Titre modifié : "${oldCard.title}" ➔ "${updates.title}"` });
      }
      if (updates.value !== undefined && parseFloat(updates.value) !== parseFloat(oldCard.value)) {
        newHistory.unshift({ date: now, userId, action: `Valeur modifiée : ${oldCard.value}€ ➔ ${updates.value}€` });
      }
      if (updates.columnId && updates.columnId !== oldCard.columnId) {
        newHistory.unshift({ date: now, userId, action: "Étape du pipeline modifiée" });
      }
      if (updates.responsibleId && updates.responsibleId !== oldCard.responsibleId) {
        newHistory.unshift({ date: now, userId, action: "Responsable modifié" });
      }

      // 3. Persist to DB
      const { data, error } = await supabase.from('pipeline_cards').update(toDbCard({ ...updates, history: newHistory })).eq('id', id).select().single();
      if (error) throw error;
      return mapCard(data);
    } catch (error) {
      console.error("Error updating card with audit:", error);
      throw error;
    }
  },

  async deleteCard(id) {
    const { error } = await supabase.from('pipeline_cards').delete().eq('id', id)
    if (error) throw error
  },

  // Tasks
  async getTasks() {
    try {
      const { data, error } = await supabase.from('tasks').select('*')
      if (error) throw error
      return (data || []).map(t => this._mapSingleTask(t))
    } catch (error) {
      console.error("Error fetching tasks:", error);
      throw error;
    }
  },

  async insertTask(task) {
    const cleanedLinkedCardId = cleanId(task.linkedCardId);
    const meta = {
      card_id: cleanedLinkedCardId,
      type: task.type || "call"
    };
    const descriptionWithMeta = (task.description || "") + `\n[meta:${JSON.stringify(meta)}]`;
    
    const taskPayload = {
      title: task.title,
      description: descriptionWithMeta,
      due_date: task.dueDate,
      end_date: task.endDate,
      status: task.status,
      assigned_to: cleanId(task.assignedTo),
      contact_id: cleanId(task.contactId),
      linked_card_id: cleanedLinkedCardId,
      type: task.type || "call"
    };

    try {
      const { data, error } = await supabase.from('tasks').insert(taskPayload).select().single();
      if (error) throw error;
      return this._mapSingleTask(data);
    } catch (err) {
      // Fallback : insertion sans la colonne linked_card_id
      const { linked_card_id, ...fallbackPayload } = taskPayload;
      const { data, error } = await supabase.from('tasks').insert(fallbackPayload).select().single();
      
      if (error) {
        console.error("Error inserting task (fallback):", error);
        throw error;
      }
      return this._mapSingleTask(data);
    }
  },

  async updateTask(id, task) {
    const cleanedLinkedCardId = cleanId(task.linkedCardId);
    const meta = {
      card_id: cleanedLinkedCardId,
      type: task.type || "call"
    };
    const descriptionWithMeta = (task.description || "") + `\n[meta:${JSON.stringify(meta)}]`;
    
    const taskPayload = {
      title: task.title,
      description: descriptionWithMeta,
      due_date: task.dueDate,
      end_date: task.endDate,
      status: task.status,
      assigned_to: cleanId(task.assignedTo),
      contact_id: cleanId(task.contactId),
      linked_card_id: cleanedLinkedCardId,
      type: task.type || "call"
    };

    try {
      const { data, error } = await supabase.from('tasks').update(taskPayload).eq('id', id).select().single();
      if (error) throw error;
      return this._mapSingleTask(data);
    } catch (err) {
      // Fallback : mise à jour sans la colonne linked_card_id
      const { linked_card_id, ...fallbackPayload } = taskPayload;
      const { data, error } = await supabase.from('tasks').update(fallbackPayload).eq('id', id).select().single();
      
      if (error) {
        console.error("Error updating task (fallback):", error);
        throw error;
      }
      return this._mapSingleTask(data);
    }
  },

  async deleteTask(id) {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) throw error
  },

  async deleteExternalTasks(userId) {
    const { error } = await supabase.from('tasks').delete().eq('assigned_to', userId).eq('status', 'external')
    if (error) throw error
  },

  // Helper pour mapper une seule tâche (utilisé après insert)
  _mapSingleTask(t) {
    let linkedCardId = t.linked_card_id;
    let type = t.type || "call"; 
    let cleanDescription = t.description || "";
    
    // Tentative d'extraction du nouveau format JSON [meta:{...}]
    const metaMatch = cleanDescription.match(/\[meta:(.+)\]/);
    if (metaMatch) {
      try {
        const meta = JSON.parse(metaMatch[1]);
        linkedCardId = meta.card_id || linkedCardId;
        type = meta.type || type;
        cleanDescription = cleanDescription.replace(/\[meta:.+\]/, "").trim();
      } catch (e) {
        // Fallback sur l'ancien format card_id si le JSON échoue
        const cardMatch = cleanDescription.match(/\[card_id:(.+)\]/);
        if (cardMatch) {
          linkedCardId = cardMatch[1];
          cleanDescription = cleanDescription.replace(/\[card_id:.+\]/, "").trim();
        }
      }
    } else {
      // Fallback sur l'ancien format card_id
      const cardMatch = cleanDescription.match(/\[card_id:(.+)\]/);
      if (cardMatch) {
        linkedCardId = cardMatch[1];
        cleanDescription = cleanDescription.replace(/\[card_id:.+\]/, "").trim();
      }
    }

    return {
      id: t.id,
      title: t.title,
      description: cleanDescription,
      dueDate: t.due_date,
      endDate: t.end_date,
      date: t.due_date ? t.due_date.split('T')[0] : null,
      time: t.due_date ? (() => {
        const d = new Date(t.due_date);
        if (isNaN(d.getTime())) return '09:00';
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      })() : '09:00',
      type: type,
      status: t.status,
      assignedTo: t.assigned_to,
      userId: t.assigned_to,
      contactId: t.contact_id,
      linkedContactId: t.contact_id,
      linkedCardId: linkedCardId,
      createdAt: t.created_at
    };
  },

  // Proposals
  async getProposals() {
    const { data, error } = await supabase.from('rdv_proposals').select('*')
    if (error) throw error
    return (data || []).map(mapProposal)
  },

  async insertProposal(proposal) {
    const { data, error } = await supabase.from('rdv_proposals').insert({
      title: proposal.title,
      agent_id: cleanId(proposal.prospectorId),
      commercial_id: cleanId(proposal.commercialId),
      contact_id: cleanId(proposal.linkedContactId),
      linked_card_id: cleanId(proposal.linkedCardId),
      proposed_date: proposal.proposedDate,
      proposed_slots: proposal.proposedSlots || [],
      duration: proposal.duration,
      notes: proposal.notes,
      status: proposal.status || 'pending'
    }).select().single()
    
    if (error) throw error
    return mapProposal(data)
  },

  async updateProposal(id, updates) {
    const { data, error } = await supabase.from('rdv_proposals').update({
      title: updates.title,
      agent_id: cleanId(updates.prospectorId),
      commercial_id: cleanId(updates.commercialId),
      contact_id: cleanId(updates.linkedContactId),
      linked_card_id: cleanId(updates.linkedCardId),
      proposed_date: updates.proposedDate,
      status: updates.status,
      notes: updates.notes,
      duration: updates.duration,
      refusal_reason: updates.refusalReason
    }).eq('id', id).select().single()
    
    if (error) throw error
    return mapProposal(data)
  },

  // Notifications
  async getNotifications(userId) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  async insertNotification(notif) {
    const { data, error } = await supabase.from('notifications').insert({
      user_id: notif.userId,
      title: notif.title || "Notification",
      message: notif.message,
      type: notif.type,
      read: notif.read || false,
      related_id: notif.relatedId
    }).select().single()
    
    if (error) throw error
    return data
  },

  async updateNotification(id, updates) {
    const { data, error } = await supabase.from('notifications').update(updates).eq('id', id).select().single()
    if (error) throw error
    return data
  },

  async syncExternalEvent(eventData) {
    const { data, error } = await supabase
      .from('tasks')
      .upsert({
        id: eventData.id, // Utilise l'ID Google pour éviter les doublons
        title: "🗓️ " + eventData.summary,
        description: eventData.description,
        due_date: eventData.start,
        status: 'external',
        assigned_to: eventData.userId,
        type: 'google'
      }, { onConflict: 'id' })
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async markAllNotificationsAsRead(userId) {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId)
    if (error) throw error
  }
}
