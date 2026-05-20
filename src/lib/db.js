import { supabase } from './supabase'

// Mapping helpers
const mapContact = (c) => ({
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
})

const toDbContact = (c) => ({
  first_name: c.firstName,
  last_name: c.lastName,
  company: c.company,
  siret: c.siret,
  postal_code: c.postalCode,
  phone: c.phone,
  email: c.email,
  industry: c.industry,
  tags: c.tags,
  notes: c.notes,
  list_id: (c.listId === 'list-default' || !c.listId) ? null : c.listId,
  assigned_agent_id: !c.assignedAgentId ? null : c.assignedAgentId,
  created_by: c.createdBy || null,
  interactions: c.interactions || [],
  last_modified: new Date().toISOString()
})

const mapPipeline = (p) => ({
  id: p.id,
  name: p.name,
  ownerId: p.owner_id,
  visibility: p.visibility,
  columns: p.pipeline_columns ? p.pipeline_columns.map(col => ({
    id: col.id,
    name: col.name,
    order: col.order,
    cards: col.pipeline_cards ? col.pipeline_cards.map(card => ({
      id: card.id,
      title: card.title,
      value: card.value,
      priority: card.priority,
      tags: card.tags || [],
      order: card.order,
      contactId: card.contact_id
    })) : []
  })).sort((a, b) => a.order - b.order) : []
})

export const db = {
  // Profiles
  async getProfiles() {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async updateUserProfile(id, updates) {
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', id).select().single()
    if (error) throw error
    return data
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
      allData = [...allData, ...data];
    }

    return allData.map(mapContact);
  },

  async insertContact(contact) {
    const { data, error } = await supabase.from('contacts').insert(toDbContact(contact)).select().single()
    if (error) throw error
    return mapContact(data)
  },

  async bulkInsertContacts(contacts) {
    const { data, error } = await supabase.from('contacts').insert(contacts.map(toDbContact)).select()
    if (error) throw error
    return data.map(mapContact)
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

  // Contact Lists
  async getContactLists() {
    const { data, error } = await supabase.from('contact_lists').select('*')
    if (error) throw error
    return data
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
    return data.map(mapPipeline)
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
    const { data, error } = await supabase.from('pipeline_cards').insert({
      column_id: card.columnId,
      contact_id: card.contactId,
      title: card.title,
      value: card.value,
      priority: card.priority,
      tags: card.tags,
      order: card.order
    }).select().single()
    if (error) throw error
    return data
  },

  async updateCard(id, updates) {
    const { data, error } = await supabase.from('pipeline_cards').update({
      column_id: updates.columnId,
      contact_id: updates.contactId,
      title: updates.title,
      value: updates.value,
      priority: updates.priority,
      tags: updates.tags,
      order: updates.order
    }).eq('id', id).select().single()
    if (error) throw error
    return data
  },

  async deleteCard(id) {
    const { error } = await supabase.from('pipeline_cards').delete().eq('id', id)
    if (error) throw error
  },

  // Tasks
  async getTasks() {
    const { data, error } = await supabase.from('tasks').select('*')
    if (error) throw error
    return data.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      dueDate: t.due_date,
      status: t.status,
      assignedTo: t.assigned_to,
      contactId: t.contact_id,
      createdAt: t.created_at
    }))
  },

  async insertTask(task) {
    const { data, error } = await supabase.from('tasks').insert({
      title: task.title,
      description: task.description,
      due_date: task.dueDate,
      status: task.status,
      assigned_to: task.assignedTo,
      contact_id: task.contactId
    }).select().single()
    if (error) throw error
    return data
  },

  // Proposals
  async getProposals() {
    const { data, error } = await supabase.from('rdv_proposals').select('*')
    if (error) throw error
    return data.map(p => ({
      id: p.id,
      contactId: p.contact_id,
      agentId: p.agent_id,
      proposedSlots: p.proposed_slots,
      status: p.status,
      createdAt: p.created_at
    }))
  },

  // Notifications
  async getNotifications(userId) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  }
}
