import React from "react";
import { useNavigate } from "react-router-dom";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { Briefcase, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useCreateProject } from "@/hooks/useProjects";
import { ProjectForm } from "@/components/projects/ProjectForm";

export default function ProjectCreatePage() {
  const navigate = useNavigate();
  const createProject = useCreateProject();

  const onSubmit = async (formData: any) => {
    try {
      const { blueprint, ...projectData } = formData;
      await createProject.mutateAsync(projectData);
      toast.success("Proyecto creado correctamente");
      navigate("/projects");
    } catch (error: any) {
      toast.error(error.message || "Error al crear el proyecto");
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full space-y-8 pb-32">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <button onClick={() => navigate("/projects")} className="hover:text-primary transition-colors">Proyectos</button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Nuevo Proyecto</span>
      </div>

      <CategoryHeader 
        title="Crear Nuevo Proyecto"
        subtitle="Completa los datos para iniciar el flujo de trabajo de una nueva cocina o carpintería."
        icon={Briefcase}
      />

      <ProjectForm 
        onSubmit={onSubmit} 
        onCancel={() => navigate("/projects")} 
        isSubmitting={createProject.isPending}
      />
    </div>
  );
}
