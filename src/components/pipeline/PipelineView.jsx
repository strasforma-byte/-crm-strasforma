import React, { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { useApp } from "@/context/AppContext";
import { usePermissions } from "@/hooks/usePermissions";
import { db } from "@/lib/db";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Lock, Globe, Settings2, MoreHorizontal, Search, X, Download, User as UserIcon, Tag as TagIcon } from "lucide-react";
import KanbanBoard from "./KanbanBoard";
import NewCardDialog from "./NewCardDialog";
import EditPipelineDialog from "./EditPipelineDialog";
import CardDetailSheet from "./CardDetailSheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useLocalStorage } from "@/hooks/useLocalStorage";

export default function PipelineView({ jumpToId, onJumpHandled }) {
  const { state, dispatch, isAdmin } = useApp();
  const { canViewPipeline, canEditPipeline } = usePermissions();

  const [activePipelineId, setActivePipelineId] = useLocalStorage("paff_active_pipeline_id", "");
  const [searchTerm, setSearchTerm] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [selectedTags, setSelectedTags] = useState([]);
  const [isNewPipelineOpen, setIsNewPipelineOpen] = useState(false);
  const [isEditPipelineOpen, setIsEditPipelineOpen] = useState(false);
  const [isNewCardOpen, setIsNewCardOpen] = useState(false);
  const [defaultColumnId, setDefaultColumnId] = useState("");
  const [selectedCard, setSelectedCard] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Jump to record from global search
  useEffect(() => {
    if (jumpToId && Array.isArray(state?.pipelines) && state.pipelines.length > 0) {
      const allDeals = (state.pipelines || []).flatMap(p => (p.columns || []).flatMap(col => col.cards || []));
      const targetDeal = allDeals.find(d => d.id === jumpToId);
      if (targetDeal) {
        setSelectedCard(targetDeal);
        const parentPipeline = (state.pipelines || []).find(p => (p.columns || []).some(col => (col.cards || []).some(c => c.id === targetDeal.id)));
        if (parentPipeline) setActivePipelineId(parentPipeline.id);
        setIsSheetOpen(true);
        if (onJumpHandled) onJumpHandled();
      }
    }
  }, [jumpToId, state?.pipelines, onJumpHandled]);

  const visiblePipelines = useMemo(() => {
    return (state?.pipelines || []).filter(p => canViewPipeline(p));
  }, [state?.pipelines, state?.currentUser, canViewPipeline]);

  const activePipeline = useMemo(() => {
    if (!Array.isArray(state?.pipelines)) return null;
    const pipe = state.pipelines.find(p => p.id === activePipelineId) || visiblePipelines[0];
    if (!pipe) return null;

    // Apply filters
    return {
      ...pipe,
      columns: (pipe.columns || []).map(col => ({
        ...col,
        cards: (col.cards || []).filter(card => {
          // 1. Agent Filter
          if (agentFilter !== "all" && card.responsibleId !== agentFilter) return false;

          // 2. Tag Filter
          if (selectedTags.length > 0) {
            const cardTags = card.tags || [];
            if (!selectedTags.every(t => cardTags.includes(t))) return false;
          }

          // 3. Search Filter
          if (!searchTerm.trim()) return true;
          const term = searchTerm.toLowerCase();
          const client = (state?.contacts || []).find(c => c.id === card.contactId || c.id === card.clientId);
          return (card.title || "").toLowerCase().includes(term) || 
                 (client?.company || "").toLowerCase().includes(term) ||
                 (client?.firstName || "").toLowerCase().includes(term) ||
                 (client?.lastName || "").toLowerCase().includes(term);
        })
      }))
    };
  }, [activePipelineId, state?.pipelines, visiblePipelines, searchTerm, agentFilter, selectedTags, state?.contacts]);

  // Set initial active pipeline if none selected
  useEffect(() => {
    if (!activePipelineId && visiblePipelines.length > 0) {
      setActivePipelineId(visiblePipelines[0].id);
    }
  }, [visiblePipelines, activePipelineId]);

  const PRESET_TAGS = [
    { label: "Urgent ⚡", value: "urgent", color: "bg-red-500" },
    { label: "Partenaire 🤝", value: "partenaire", color: "bg-purple-500" },
    { label: "Premium ⭐", value: "premium", color: "bg-amber-500" },
    { label: "Suivi 🔔", value: "follow-up", color: "bg-blue-500" },
    { label: "Attente ⏳", value: "on-hold", color: "bg-slate-500" }
  ];

  const toggleTagFilter = (tagValue) => {
    setSelectedTags(prev => 
      prev.includes(tagValue) ? prev.filter(t => t !== tagValue) : [...prev, tagValue]
    );
  };

  const [newPipeName, setNewPipeName] = useState("");
  const [newPipePublic, setNewPipePublic] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const handleQuickCreate = (columnId) => {
    setDefaultColumnId(columnId);
    setIsNewCardOpen(true);
  };

  const handleCreatePipeline = async () => {
    if (!newPipeName) {
      toast.error("Le nom du pipeline est requis");
      return;
    }
    
    setIsCreating(true);
    try {
      const newPipelineData = {
        name: newPipeName,
        ownerId: state.currentUser.id,
        visibility: newPipePublic ? "public" : "private",
        columns: [
          { name: "Nouveau Lead", order: 0 },
          { name: "Qualifié", order: 1 },
          { name: "Proposition", order: 2 },
          { name: "Gagné ✅", order: 3 },
        ]
      };

      const savedPipeline = await db.insertPipeline(newPipelineData);
      
      dispatch({ type: "UPDATE_PIPELINES", payload: (prev) => [...(prev || []), savedPipeline] });
      setActivePipelineId(savedPipeline.id);
      setIsNewPipelineOpen(false);
      setNewPipeName("");
      toast.success("Pipeline créé avec succès");
    } catch (error) {
      console.error("Error creating pipeline:", error);
      toast.error("Erreur lors de la création du pipeline");
    } finally {
      setIsCreating(false);
    }
  };

  const handleExportExcel = () => {
    if (!activePipeline) return;
    
    try {
      const dataToExport = activePipeline.columns.flatMap(col => 
        (col.cards || []).map(card => {
          const contacts = Array.isArray(state.contacts) ? state.contacts : [];
          const users = Array.isArray(state.users) ? state.users : [];
          const client = contacts.find(c => c.id === card.contactId || c.id === card.clientId);
          const responsible = users.find(u => u.id === card.responsibleId);
          return {
            Affaire: card.title,
            Étape: col.name,
            Valeur: card.value,
            Entreprise: client?.company || "Inconnue",
            Contact: client ? `${client.firstName} ${client.lastName}` : "Inconnu",
            Responsable: responsible?.name || "Non assigné",
            Priorité: card.priority
          };
        })
      );

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Pipeline");
      
      const fileName = `crm-pipeline-${activePipeline.name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success("Pipeline exporté avec succès");
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error("Erreur lors de l'exportation du pipeline");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 z-30">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1 w-full">
          <div className="flex items-center gap-2">
            <Select value={activePipelineId || activePipeline?.id} onValueChange={setActivePipelineId}>
              <SelectTrigger className="w-[200px] font-bold text-lg border-none bg-transparent hover:bg-slate-50 focus:ring-0 px-2 h-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {visiblePipelines.map(p => (
                  <SelectItem key={p.id} value={p.id} className="font-medium">
                    {p.name} {p.ownerId === state.currentUser?.id ? "(Moi)" : `(${state.users.find(u => u.id === p.ownerId)?.name || "Inconnu"})`}
                  </SelectItem>
                ))}
                <div className="p-2 border-t mt-1">
                  <Button variant="ghost" size="sm" className="w-full justify-start text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => setIsNewPipelineOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nouveau Pipeline
                  </Button>
                </div>
              </SelectContent>
            </Select>

            {activePipeline && (
              <Badge variant="outline" className={`rounded-full flex items-center gap-1.5 px-3 py-1 ${activePipeline.visibility === 'public' ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-slate-600 bg-slate-50 border-slate-100'}`}>
                {activePipeline.visibility === "public" ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                <span className="hidden sm:inline">{activePipeline.visibility === "public" ? "Public" : "Privé"}</span>
              </Badge>
            )}
          </div>

          <div className="flex flex-col gap-4 flex-1 w-full sm:ml-4">
            <div className="flex items-center gap-3 w-full">
              <div className="relative flex-1 max-w-xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Rechercher une affaire, entreprise, contact..." 
                  className="pl-10 h-9 text-sm border-slate-100 bg-slate-50/50 focus:bg-white transition-all shadow-inner"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setSearchTerm("")}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger className="w-[160px] h-9 text-xs border-slate-100 bg-slate-50/50 font-black uppercase tracking-tighter">
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                    <SelectValue placeholder="Agent" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les Agents</SelectItem>
                  {state.users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 mr-2 tracking-widest">
                <TagIcon className="w-3 h-3" /> Filtrer par tags
              </div>
              {PRESET_TAGS.map(tag => {
                const isActive = selectedTags.includes(tag.value);
                return (
                  <button
                    key={tag.value}
                    onClick={() => toggleTagFilter(tag.value)}
                    className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase transition-all ${
                      isActive 
                        ? `${tag.color} border-transparent ring-2 ring-offset-1 ring-slate-100 text-white` 
                        : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                    }`}
                  >
                    {tag.label}
                  </button>
                );
              })}
              {selectedTags.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-[9px] font-black uppercase text-slate-400 hover:text-red-500"
                  onClick={() => setSelectedTags([])}
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Effacer
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
          <div className="flex -space-x-2 mr-4 overflow-hidden">
            {(state.users || []).slice(0, 4).map(u => (
              <Badge key={u.id} className="w-8 h-8 rounded-full border-2 border-white p-0 flex items-center justify-center text-[10px]" style={{ backgroundColor: u.color }}>
                {u.name?.charAt(0) || "?"}
              </Badge>
            ))}
          </div>
          
          {activePipeline && canEditPipeline(activePipeline) && (
            <Button variant="outline" size="sm" className="hidden lg:flex" onClick={() => setIsEditPipelineOpen(true)}>
              <Settings2 className="w-4 h-4 mr-2" />
              Modifier
            </Button>
          )}

          <Button variant="outline" size="sm" className="hidden sm:flex" onClick={handleExportExcel}>
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
          
          <Button onClick={() => setIsNewCardOpen(true)} className="bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-100">
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle Affaire
          </Button>
        </div>
      </div>

      <main className="flex-1 overflow-x-auto overflow-y-hidden bg-slate-50/50 p-6 scrollbar-hide">
        {activePipeline && (
          <KanbanBoard 
            pipeline={activePipeline} 
            onQuickCreate={handleQuickCreate}
            onCardClick={(card) => {
              setSelectedCard(card);
              setIsSheetOpen(true);
            }}
          />
        )}
      </main>

      <CardDetailSheet 
        card={selectedCard} 
        pipeline={Array.isArray(state.pipelines) ? state.pipelines.find(p => (p.columns || []).some(col => (col.cards || []).some(c => c.id === selectedCard?.id))) : null}
        open={isSheetOpen} 
        onOpenChange={setIsSheetOpen} 
      />

      {/* New Pipeline Dialog */}
      <Dialog open={isNewPipelineOpen} onOpenChange={setIsNewPipelineOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Nouveau Pipeline Commercial</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Nom du pipeline</Label>
              <Input 
                placeholder="Ex: Ventes Directes 2025" 
                value={newPipeName}
                onChange={(e) => setNewPipeName(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="space-y-0.5">
                <Label>Visibilité publique</Label>
                <p className="text-xs text-slate-500">Tout le monde pourra voir ce pipeline</p>
              </div>
              <Switch checked={newPipePublic} onCheckedChange={setNewPipePublic} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewPipelineOpen(false)}>Annuler</Button>
            <Button className="bg-green-600 text-white font-bold" onClick={handleCreatePipeline} disabled={isCreating}>
              {isCreating ? "Création..." : "Créer le pipeline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditPipelineDialog 
        open={isEditPipelineOpen}
        onOpenChange={setIsEditPipelineOpen}
        pipeline={activePipeline}
      />

      <NewCardDialog 
        open={isNewCardOpen} 
        onOpenChange={(val) => {
          setIsNewCardOpen(val);
          if (!val) setDefaultColumnId("");
        }}
        defaultPipelineId={activePipeline?.id}
        defaultColumnId={defaultColumnId}
      />
    </div>
  );
}

function KanbanSquare({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h4v4H7z"/><path d="M13 7h4v4h-4z"/><path d="M7 13h4v4H7z"/><path d="M13 13h4v4h-4z"/></svg>
  )
}
