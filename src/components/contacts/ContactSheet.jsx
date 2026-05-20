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
  MapPin
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";

export default function ContactSheet({ contact, open, onOpenChange, activeListId }) {
  const { state, dispatch } = useApp();
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
    // Nom and SIRET are now mandatory
    if (!formData.lastName || !formData.siret) {
      toast.error("Le Nom et le SIRET sont obligatoires");
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

  const pipelines = Array.isArray(state.pipelines) ? state.pipelines : [];
  const linkedDeals = pipelines.flatMap(p => 
    (p.columns || []).flatMap(col => 
      (col.cards || []).filter(card => card.clientId === contact?.id)
    )
  );

  const users = Array.isArray(state.users) ? state.users : [];

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
                  <Label>Prénom *</Label>
                  <Input value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Nom *</Label>
                  <Input value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Entreprise</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input className="pl-10" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>SIRET</Label>
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
                <Label>Email *</Label>
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
