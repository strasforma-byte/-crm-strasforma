import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Check, 
  X, 
  Calendar as CalendarIcon, 
  Clock, 
  User as UserIcon, 
  Briefcase,
  Building2,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function ProposalSheet({ proposal, open, onOpenChange }) {
  const { state, dispatch, refreshAllData } = useApp();
  const [isRefuseDialogOpen, setIsRefuseDialogOpen] = useState(false);
  const [refusalReason, setRefusalReason] = useState("");

  if (!proposal) return null;

  const prospector = state.users.find(u => u.id === proposal.prospectorId);
  const contact = state.contacts.find(c => c.id === proposal.linkedContactId);
  const card = (Array.isArray(state.pipelines) ? state.pipelines : []).flatMap(p => (p.columns || []).flatMap(col => (col.cards || []))).find(c => c.id === proposal.linkedCardId);

  const handleAccept = async () => {
    try {
      // 1. Update proposal status in DB
      await db.updateProposal(proposal.id, { ...proposal, status: "accepted" });
      
      const updatedProposals = state.rdvProposals.map(p => 
        p.id === proposal.id ? { ...p, status: "accepted" } : p
      );
      
      // 2. Create actual task using DB helper for robustness
      const taskData = {
        assignedTo: proposal.commercialId,
        title: "🤝 " + proposal.title,
        type: "meeting",
        dueDate: new Date(proposal.proposedDate).toISOString(),
        linkedContactId: proposal.linkedContactId,
        linkedCardId: proposal.linkedCardId,
        status: "pending",
        description: proposal.notes || ""
      };

      const savedTask = await db.insertTask(taskData);
      
      // Audit automatique pour l'affaire liée
      if (proposal.linkedCardId) {
        const pipeline = (Array.isArray(state.pipelines) ? state.pipelines : []).find(p => p.columns.some(col => col.cards.some(c => c.id === proposal.linkedCardId)));
        if (pipeline) {
          const card = pipeline.columns.flatMap(col => col.cards).find(c => c.id === proposal.linkedCardId);
          if (card) {
            const historyEntry = {
              date: new Date().toISOString(),
              userId: state.currentUser.id,
              action: `Proposition de RDV acceptée : ${proposal.title}`
            };
            const updatedCard = { ...card, history: [historyEntry, ...(card.history || [])] };
            await db.updateCard(card.id, updatedCard);
            
            const updatedPipelinesForHistory = state.pipelines.map(p => p.id === pipeline.id ? {
              ...p,
              columns: p.columns.map(col => ({
                ...col,
                cards: col.cards.map(c => c.id === card.id ? updatedCard : c)
              }))
            } : p);
            dispatch({ type: "UPDATE_PIPELINES", payload: updatedPipelinesForHistory });
          }
        }
      }
      
      // 3. Create notification for prospector in DB
      const newNotifData = {
        userId: proposal.prospectorId,
        type: "rdv_proposal_accepted",
        message: `${state.currentUser.name} a accepté votre proposition : ${proposal.title}`,
        relatedId: proposal.id,
        read: false
      };

      const savedNotif = await db.insertNotification(newNotifData);

      dispatch({ type: "UPDATE_PROPOSALS", payload: updatedProposals });
      dispatch({ type: "UPDATE_TASKS", payload: [...state.tasks, savedTask] });
      dispatch({ type: "UPDATE_NOTIFICATIONS", payload: [...state.notifications, savedNotif] });
      
      toast.success("Proposition acceptée et ajoutée à l'agenda");
      onOpenChange(false);
    } catch (error) {
      console.error("Error accepting proposal:", error);
      toast.error("Erreur lors de l'acceptation de la proposition");
    }
  };

  const handleRefuse = async () => {
    try {
      // Update proposal status in DB
      await db.updateProposal(proposal.id, { ...proposal, status: "refused", refusalReason });

      // Audit automatique pour l'affaire liée
      if (proposal.linkedCardId) {
        const pipeline = (Array.isArray(state.pipelines) ? state.pipelines : []).find(p => p.columns.some(col => col.cards.some(c => c.id === proposal.linkedCardId)));
        if (pipeline) {
          const card = pipeline.columns.flatMap(col => col.cards).find(c => c.id === proposal.linkedCardId);
          if (card) {
            const historyEntry = {
              date: new Date().toISOString(),
              userId: state.currentUser.id,
              action: `Proposition de RDV refusée : ${proposal.title}${refusalReason ? ` (Raison : ${refusalReason})` : ""}`
            };
            const updatedCard = { ...card, history: [historyEntry, ...(card.history || [])] };
            await db.updateCard(card.id, updatedCard);
            // Refresh to ensure history is updated in state
            await refreshAllData();
          }
        }
      }

      const updatedProposals = state.rdvProposals.map(p => 
        p.id === proposal.id ? { ...p, status: "refused", refusalReason } : p
      );

      // Create notification for prospector in DB
      const newNotifData = {
        userId: proposal.prospectorId,
        type: "rdv_proposal_refused",
        message: `${state.currentUser.name} a refusé votre proposition : ${proposal.title}${refusalReason ? ` (Raison : ${refusalReason})` : ""}`,
        relatedId: proposal.id,
        read: false
      };

      const savedNotif = await db.insertNotification(newNotifData);

      dispatch({ type: "UPDATE_PROPOSALS", payload: updatedProposals });
      dispatch({ type: "UPDATE_NOTIFICATIONS", payload: [...state.notifications, savedNotif] });
      
      toast.error("Proposition refusée");
      setIsRefuseDialogOpen(false);
      onOpenChange(false);
    } catch (error) {
      console.error("Error refusing proposal:", error);
      toast.error("Erreur lors du refus de la proposition");
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-[450px] p-0 flex flex-col">
          <SheetHeader className="p-6 bg-amber-50 border-b border-amber-100">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-amber-400 text-amber-900 border-none">Proposition de RDV</Badge>
              <Badge variant="outline" className="bg-white border-amber-200">En attente</Badge>
            </div>
            <SheetTitle className="text-xl font-black text-amber-900">{proposal.title}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 p-6 space-y-8 overflow-y-auto">
            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <Avatar className="w-10 h-10 border-2 border-white shadow-sm" style={{ backgroundColor: prospector?.color }}>
                <AvatarFallback className="text-white font-bold">{prospector?.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-bold text-slate-900">Proposé par {prospector?.name}</p>
                <p className="text-xs text-slate-500">Le {format(new Date(proposal.createdAt), "dd MMM à HH:mm", { locale: fr })}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-700">
                <CalendarIcon className="w-5 h-5 text-slate-400" />
                <span className="font-medium">{format(new Date(proposal.proposedDate), "EEEE d MMMM yyyy", { locale: fr })}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-700">
                <Clock className="w-5 h-5 text-slate-400" />
                <span className="font-medium">{format(new Date(proposal.proposedDate), "HH:mm")} ({proposal.duration} minutes)</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Liens CRM</div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-white border rounded-lg">
                  <UserIcon className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-bold">{contact?.firstName} {contact?.lastName}</p>
                    <p className="text-[10px] text-slate-500 uppercase">{contact?.company}</p>
                  </div>
                </div>
                {card && (
                  <div className="flex items-center gap-3 p-3 bg-white border rounded-lg">
                    <Briefcase className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-bold">{card.title}</p>
                      <p className="text-[10px] text-slate-500 uppercase">{card.value} €</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {proposal.notes && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Notes du prospecteur</div>
                <div className="p-3 bg-slate-50 rounded-lg text-sm italic text-slate-600 border border-slate-100">
                  "{proposal.notes}"
                </div>
              </div>
            )}
          </div>

          <SheetFooter className="p-6 border-t bg-white gap-2">
            <Button variant="outline" className="flex-1 text-red-600 border-red-100 hover:bg-red-50" onClick={() => setIsRefuseDialogOpen(true)}>
              <X className="w-4 h-4 mr-2" /> Refuser
            </Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleAccept}>
              <Check className="w-4 h-4 mr-2" /> Accepter
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={isRefuseDialogOpen} onOpenChange={setIsRefuseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la proposition</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Raison du refus (optionnel)</Label>
              <Textarea 
                placeholder="Ex: Déjà en rendez-vous extérieur..." 
                value={refusalReason} 
                onChange={e => setRefusalReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRefuseDialogOpen(false)}>Annuler</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleRefuse}>Confirmer le refus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
