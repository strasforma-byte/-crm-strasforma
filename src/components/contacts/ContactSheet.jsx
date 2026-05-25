import React, { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { db } from "@/lib/db";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  Phone, 
  Mail, 
  History, 
  Briefcase, 
  Plus, 
  Trash2,
  Tag,
  User,
  Fingerprint,
  MapPin,
  CheckSquare,
  Clock,
  MessageSquare,
  CheckCircle2,
  X
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ContactSheet({ contact, open, onOpenChange, activeListId }) {
  const { state, dispatch, refreshAllData } = useApp();
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    company: "",
    siret: "",
    postalCode: "",
    phone: "",
    email: "",
    tags: [],
    notes: "",
    industry: "",
    assignedAgentId: ""
  });

  useEffect(() => {
    if (contact) {
      setFormData({
        firstName: contact.firstName || "",
        lastName: contact.lastName || "",
        company: contact.company || "",
        siret: contact.siret || "",
        postalCode: contact.postalCode || "",
        phone: contact.phone || "",
        email: contact.email || "",
        tags: Array.isArray(contact.tags) ? contact.tags : [],
        notes: contact.notes || "",
        industry: contact.industry || "",
        assignedAgentId: contact.assignedAgentId || ""
      });
    } else {
      setFormData({
        firstName: "",
        lastName: "",
        company: "",
        siret: "",
        postalCode: "",
        phone: "",
        email: "",
        tags: ["prospect"],
        notes: "",
        industry: "",
        assignedAgentId: ""
      });
    }
  }, [contact, open]);

  const handleSave = async () => {
    // Nom, Société and SIRET are now mandatory
    if (!formData.lastName || !formData.company || !formData.siret) {
      toast.error("Le Nom, la Société et le SIRET sont obligatoires");
      return;
    }

    setIsSaving(true);
    try {
      const contacts = Array.isArray(state.contacts) ? state.contacts : [];

      if (contact) {
        // Prepare updated object
        const updatedData = {
          ...contact,
          ...formData,
          // Ensure nulls for database if empty
          assignedAgentId: formData.assignedAgentId || null
        };

        const savedContact = await db.updateContact(contact.id, updatedData);
        
        const updated = contacts.map(c => 
          c.id === contact.id ? savedContact : c
        );
        dispatch({ type: "UPDATE_CONTACTS", payload: updated });
        toast.success("Contact mis à jour");
      } else {
        const newContactData = {
          createdBy: state.currentUser?.id,
          listId: activeListId || "list-default",
          ...formData,
          assignedAgentId: formData.assignedAgentId || null,
          interactions: [],
          createdAt: new Date().toISOString()
        };
        const savedContact = await db.insertContact(newContactData);
        dispatch({ type: "UPDATE_CONTACTS", payload: [...contacts, savedContact] });
        toast.success("Contact créé");
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving contact:", error);
      toast.error(`Erreur : ${error.message || "Problème lors de la sauvegarde"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) 
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const [logType, setLogType] = useState(null); // 'call' | 'email' | null
  const [logContent, setLogContent] = useState("");
  const [isLogging, setIsLogging] = useState(false);

  const pipelines = Array.isArray(state.pipelines) ? state.pipelines : [];
  const linkedDeals = pipelines.flatMap(p => 
    (p.columns || []).flatMap(col => 
      (col.cards || []).filter(card => card.clientId === contact?.id || card.contactId === contact?.id)
    )
  );

  const linkedTasks = (state.tasks || []).filter(t => 
    t.contactId === contact?.id || t.linkedContactId === contact?.id
  );

  const users = Array.isArray(state.users) ? state.users : [];

  const handleLogInteraction = async () => {
    if (!contact || !logContent.trim()) return;
    setIsLogging(true);
    try {
      const newInteraction = {
        id: "int-" + Date.now(),
        type: logType,
        content: logContent.trim(),
        date: new Date().toISOString(),
        userId: state.currentUser.id
      };

      const updatedContact = {
        ...contact,
        interactions: [newInteraction, ...(contact.interactions || [])]
      };

      await db.updateContact(contact.id, updatedContact);
      
      // Mirror in linked deals history
      for (const deal of linkedDeals) {
        const historyEntry = {
          date: newInteraction.date,
          userId: newInteraction.userId,
          action: `${logType === 'call' ? '📞 Appel' : '📧 Email'} consigné : ${logContent.trim()}`
        };
        const updatedDeal = {
          ...deal,
          history: [historyEntry, ...(deal.history || [])]
        };
        await db.updateCard(deal.id, updatedDeal);
      }

      dispatch({ 
        type: "UPDATE_CONTACTS", 
        payload: state.contacts.map(c => c.id === contact.id ? updatedContact : c) 
      });
      
      if (linkedDeals.length > 0) {
        await refreshAllData();
      }

      toast.success("Interaction consignée");
      setLogType(null);
      setLogContent("");
    } catch (error) {
      console.error("Error logging interaction:", error);
      toast.error("Erreur lors de la consignation");
    } finally {
      setIsLogging(false);
    }
  };

  const handleCompleteTask = async (task) => {
    try {
      const updatedTasks = state.tasks.map(t => t.id === task.id ? { ...t, status: "done" } : t);
      await db.updateTask(task.id, { ...task, status: "done" });
      dispatch({ type: "UPDATE_TASKS", payload: updatedTasks });

      // Audit automatique pour les affaires liées
      if (task.linkedCardId) {
        const pipeline = (Array.isArray(state.pipelines) ? state.pipelines : []).find(p => p.columns.some(col => col.cards.some(c => c.id === task.linkedCardId)));
        if (pipeline) {
          const card = pipeline.columns.flatMap(col => col.cards).find(c => c.id === task.linkedCardId);
          if (card) {
            const historyEntry = {
              date: new Date().toISOString(),
              userId: state.currentUser.id,
              action: `Action terminée depuis la fiche contact : ${task.title}`
            };
            const updatedCard = { ...card, history: [historyEntry, ...(card.history || [])] };
            await db.updateCard(card.id, updatedCard);
            await refreshAllData();
          }
        }
      }

      toast.success("Action terminée !");
    } catch (error) {
      console.error("Error completing task:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="sm:max-w-[520px] p-0 flex flex-col">
        <SheetHeader className="p-6 border-b">
          <SheetTitle>{contact ? "Fiche Contact" : "Nouveau Contact"}</SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            {/* Section Informations */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold uppercase text-xs tracking-wider">
                <User className="w-4 h-4" />
                Informations Générales
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prénom</Label>
                  <Input value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Nom *</Label>
                  <Input value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Entreprise *</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input className="pl-10" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>SIRET *</Label>
                <div className="relative">
                  <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input className="pl-10" placeholder="123 456 789 00012" value={formData.siret} onChange={e => setFormData({...formData, siret: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Secteur</Label>
                  <Input placeholder="Secteur..." value={formData.industry} onChange={e => setFormData({...formData, industry: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Agent</Label>
                  <Select value={formData.assignedAgentId || "none"} onValueChange={val => setFormData({...formData, assignedAgentId: val === "none" ? "" : val})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Agent..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">--- Libre ---</SelectItem>
                      {users.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input className="pl-10" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Code Postal</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input className="pl-10" placeholder="75000" value={formData.postalCode} onChange={e => setFormData({...formData, postalCode: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input className="pl-10" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
              </div>
            </div>

            {/* Section Tags */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold uppercase text-xs tracking-wider">
                <Tag className="w-4 h-4" />
                Tags
              </div>
              <div className="flex flex-wrap gap-2">
                {["client", "prospect", "partenaire", "VIP"].map(tag => (
                  <Badge 
                    key={tag} 
                    variant={formData.tags.includes(tag) ? "default" : "outline"}
                    className={`cursor-pointer ${formData.tags.includes(tag) ? 'bg-green-600' : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Affaires liées */}
            {contact && linkedDeals.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold uppercase text-xs tracking-wider">
                  <Briefcase className="w-4 h-4" />
                  Affaires liées
                </div>
                <div className="space-y-2">
                  {linkedDeals.map(deal => (
                    <div key={deal.id} className="p-2 bg-slate-50 border rounded text-sm flex justify-between">
                      <span>{deal.title}</span>
                      <span className="font-bold">{deal.value} €</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions liées */}
            {contact && linkedTasks.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold uppercase text-xs tracking-wider">
                  <CheckSquare className="w-4 h-4" />
                  Actions & Tâches
                </div>
                <div className="space-y-2">
                  {[...linkedTasks]
                    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
                    .map(task => (
                    <div key={task.id} className="p-2 bg-slate-50 border rounded-lg flex items-center gap-3 group">
                      <div className={`p-1.5 rounded-full ${task.status === 'done' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-bold truncate ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                          {task.title}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {format(new Date(task.dueDate), "dd/MM/yyyy")} à {task.time}
                        </p>
                      </div>
                      {task.status === 'done' ? (
                        <Badge className="bg-green-600 text-[9px] h-4 text-white border-none">Fait</Badge>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity p-0 hover:bg-green-50"
                          onClick={() => handleCompleteTask(task)}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-4">
              <Label>Notes libres</Label>
              <Textarea 
                placeholder="Notes..." 
                className="min-h-[100px]"
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
              />
            </div>

            {/* Consigner une interaction */}
            {contact && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold uppercase text-xs tracking-wider">
                  <MessageSquare className="w-4 h-4" />
                  Consigner un événement
                </div>
                
                {!logType ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-[11px] h-8 border-blue-100 text-blue-600 hover:bg-blue-50 font-bold"
                      onClick={() => setLogType("call")}
                    >
                      <Phone className="w-3 h-3 mr-1.5" /> Appel passé
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-[11px] h-8 border-purple-100 text-purple-600 hover:bg-purple-50 font-bold"
                      onClick={() => setLogType("email")}
                    >
                      <Mail className="w-3 h-3 mr-1.5" /> Email envoyé
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100 animate-in zoom-in-95">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-slate-400">
                        Détails de {logType === 'call' ? "l'appel" : "l'email"}
                      </span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setLogType(null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <Textarea 
                      autoFocus
                      placeholder={logType === 'call' ? "Bilan de l'appel..." : "Objet ou contenu de l'email..."}
                      className="min-h-[60px] text-xs bg-white border-slate-200"
                      value={logContent}
                      onChange={(e) => setLogContent(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs font-bold" onClick={() => setLogType(null)}>Annuler</Button>
                      <Button 
                        size="sm" 
                        className={`h-7 text-xs text-white font-bold ${logType === 'call' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                        onClick={handleLogInteraction}
                        disabled={isLogging || !logContent.trim()}
                      >
                        {isLogging ? "Enregistrement..." : "Enregistrer"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Historique des interactions */}
            {contact && (contact.interactions || []).length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold uppercase text-xs tracking-wider">
                  <History className="w-4 h-4" />
                  Historique Contact
                </div>
                <div className="space-y-3 pl-4 border-l-2 border-slate-100">
                  {contact.interactions.slice(0, 10).map((int, i) => (
                    <div key={i} className="text-[11px] relative">
                      <div className="absolute -left-[21px] top-0.5 bg-white p-0.5">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                      </div>
                      <p className="font-bold text-slate-900">
                        {format(new Date(int.date), "dd/MM HH:mm")} — {int.type === 'call' ? '📞 Appel' : '📧 Email'}
                      </p>
                      <p className="text-slate-500 italic mt-0.5">"{int.content}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="p-6 border-t bg-white">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="mr-2">Annuler</Button>
          <Button className="bg-green-600 hover:bg-green-700" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
