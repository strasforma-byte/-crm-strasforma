import { supabase } from './supabase'

// Mapping helpers
const mapContact = (c) => ({
  id: c.id,
  firstName: c.first_name,
  lastName: c.last_name,
  company: c.company,
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
  phone: c.phone,
  email: c.email,
  industry: c.industry,
  tags: c.tags,
  notes: c.notes,
  list_id: c.listId,
  assigned_agent_id: c.assignedAgentId,
  created_by: c.createdBy,
  interactions: c.interactions,
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
    const { data, error } = await supabase.from('contacts').select('*')
    if (error) throw error
    return data.map(mapContact)
  },

  async insertContact(contact) {
    const { data, error } = await supabase.from('contacts').insert(toDbContact(contact)).select().single()
    if (error) throw error
    return mapContact(data)
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

  async insertPipeline(pipeline) {
    const { data, error } = await supabase.from('pipelines').insert({
      name: pipeline.name,
      owner_id: pipeline.ownerId,
      visibility: pipeline.visibility
    }).select().single()
    if (error) throw error
    return mapPipeline(data)
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
