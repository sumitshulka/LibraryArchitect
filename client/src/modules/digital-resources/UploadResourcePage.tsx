import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, ArrowRight, Upload, Link as LinkIcon, FileText, Check, Loader2, X, Save,
} from "lucide-react";
import { toast } from "sonner";
import { digitalResourcesApi, librariesApi, searchAttributesApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DigitalResourceAttributesEditor } from "@/components/DigitalResourceAttributesEditor";

const RESOURCE_TYPES = ["PDF", "DOC", "DOCX", "PPT", "PPTX", "XLS", "XLSX", "ZIP", "IMAGE", "VIDEO", "AUDIO", "HTML", "SCORM", "EXTERNAL_URL", "YOUTUBE", "GOOGLE_DRIVE", "ONEDRIVE"];
const CATEGORIES = ["TEXTBOOK", "LECTURE_NOTES", "LAB_MANUAL", "QUESTION_BANK", "PRESENTATION", "RESEARCH_PAPER", "ASSIGNMENT", "CASE_STUDY", "REFERENCE_MATERIAL", "TUTORIAL", "VIDEO_LECTURE", "POLICY_DOCUMENT", "OTHER"];
const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const VISIBILITIES = [
  { value: "INSTITUTION", label: "Entire Institution" },
  { value: "LIBRARY", label: "Specific Library" },
  { value: "DEPARTMENT", label: "Department Only" },
  { value: "COURSE", label: "Course Only" },
  { value: "BATCH", label: "Batch Only" },
  { value: "FACULTY_ONLY", label: "Faculty Only" },
  { value: "STUDENTS_ONLY", label: "Students Only" },
  { value: "ROLE_BASED", label: "Specific Roles" },
];

const STEPS = ["File / Source", "Metadata", "Visibility & Access", "Review"];

export default function UploadResourcePage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState(0);

  const [sourceMode, setSourceMode] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<number[]>([]);

  const [form, setForm] = useState({
    title: "",
    shortDescription: "",
    description: "",
    keywords: "",
    tags: "",
    resourceType: "PDF",
    language: "",
    isbn: "",
    doi: "",
    author: "",
    faculty: "",
    libraryId: "" as string,
    department: "",
    program: "",
    course: "",
    subject: "",
    semester: "",
    academicYear: "",
    section: "",
    batch: "",
    category: "" as string,
    topics: "",
    learningOutcomes: "",
    credits: "",
    estimatedReadingTimeMinutes: "",
    difficulty: "" as string,
    visibility: "INSTITUTION",
    visibleToRoles: [] as string[],
    allowDownload: true,
    allowPreview: true,
    publishNow: false,
    versionNumber: "1.0",
    releaseNotes: "",
  });

  const { data: libraries = [] } = useQuery({
    queryKey: ["libraries", "active"],
    queryFn: librariesApi.getActive,
  });

  const { data: attributeTypes = [] } = useQuery({
    queryKey: ["search-attribute-types"],
    queryFn: searchAttributesApi.getTypes,
  });

  const selectedAttributeLabels = attributeTypes
    .flatMap((t) => t.values.map((v) => ({ id: v.id, label: `${t.name}: ${v.value}` })))
    .filter((v) => selectedAttributeIds.includes(v.id));

  const update = (patch: Partial<typeof form>) => setForm(prev => ({ ...prev, ...patch }));

  const createMutation = useMutation({
    mutationFn: async () => {
      let fileUrl: string | undefined;
      let fileName: string | undefined;
      let fileSizeBytes: number | undefined;

      if (sourceMode === "file" && file) {
        const uploaded = await digitalResourcesApi.uploadFile(file);
        fileUrl = uploaded.fileUrl;
        fileName = uploaded.fileName;
        fileSizeBytes = uploaded.fileSizeBytes;
      }

      const payload: any = {
        title: form.title,
        shortDescription: form.shortDescription || undefined,
        description: form.description || undefined,
        keywords: form.keywords ? form.keywords.split(",").map(s => s.trim()).filter(Boolean) : undefined,
        tags: form.tags ? form.tags.split(",").map(s => s.trim()).filter(Boolean) : undefined,
        resourceType: form.resourceType,
        language: form.language || undefined,
        isbn: form.isbn || undefined,
        doi: form.doi || undefined,
        author: form.author || undefined,
        faculty: form.faculty || undefined,
        libraryId: form.libraryId ? parseInt(form.libraryId) : undefined,
        department: form.department || undefined,
        program: form.program || undefined,
        course: form.course || undefined,
        subject: form.subject || undefined,
        semester: form.semester || undefined,
        academicYear: form.academicYear || undefined,
        section: form.section || undefined,
        batch: form.batch || undefined,
        category: form.category || undefined,
        topics: form.topics || undefined,
        learningOutcomes: form.learningOutcomes || undefined,
        credits: form.credits ? parseInt(form.credits) : undefined,
        estimatedReadingTimeMinutes: form.estimatedReadingTimeMinutes ? parseInt(form.estimatedReadingTimeMinutes) : undefined,
        difficulty: form.difficulty || undefined,
        visibility: form.visibility,
        visibleToRoles: form.visibility === "ROLE_BASED" ? form.visibleToRoles : undefined,
        allowDownload: form.allowDownload,
        allowPreview: form.allowPreview,
        status: form.publishNow ? "PUBLISHED" : "DRAFT",
        publishDate: form.publishNow ? new Date().toISOString() : undefined,
        fileUrl,
        fileName,
        fileSizeBytes,
        externalUrl: sourceMode === "url" ? externalUrl : undefined,
        versionNumber: form.versionNumber || "1.0",
        releaseNotes: form.releaseNotes || undefined,
      };

      const created = await digitalResourcesApi.create(payload);

      if (selectedAttributeIds.length > 0) {
        await searchAttributesApi.setDigitalResourceAttributes(created.id, selectedAttributeIds);
      }

      return created;
    },
    onSuccess: (resource) => {
      queryClient.invalidateQueries({ queryKey: ["digital-resources"] });
      toast.success("Digital resource uploaded successfully");
      setLocation(`/digital-resources/${resource.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const canProceedStep0 = sourceMode === "file" ? !!file : externalUrl.trim().length > 0;
  const canProceedStep1 = form.title.trim().length > 0;

  const goNext = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const goBack = () => setStep(s => Math.max(s - 1, 0));

  const toggleRole = (role: string) => {
    setForm(prev => ({
      ...prev,
      visibleToRoles: prev.visibleToRoles.includes(role)
        ? prev.visibleToRoles.filter(r => r !== role)
        : [...prev.visibleToRoles, role],
    }));
  };

  return (
    <MainLayout>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/digital-resources/repository")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Upload Digital Resource</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              i < step ? "bg-green-100 text-green-700 border border-green-300" :
              i === step ? "bg-primary text-primary-foreground" :
              "bg-muted text-muted-foreground"
            }`} data-testid={`step-indicator-${i}`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${i === step ? "font-medium" : "text-muted-foreground"}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose Source</CardTitle>
            <CardDescription>Upload a file or link to an external resource.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant={sourceMode === "file" ? "default" : "outline"} onClick={() => setSourceMode("file")} className="gap-2" data-testid="button-mode-file">
                <Upload className="h-4 w-4" /> Upload File
              </Button>
              <Button variant={sourceMode === "url" ? "default" : "outline"} onClick={() => setSourceMode("url")} className="gap-2" data-testid="button-mode-url">
                <LinkIcon className="h-4 w-4" /> External Link
              </Button>
            </div>

            {sourceMode === "file" ? (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  id="file-input"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  data-testid="input-file"
                />
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-8 w-8 text-blue-600" />
                    <div className="text-left">
                      <p className="font-medium text-sm">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setFile(null)} data-testid="button-remove-file">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label htmlFor="file-input" className="cursor-pointer">
                    <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">Click to select a file</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, Office docs, images, video, audio, ZIP (max 200MB)</p>
                  </label>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="external-url">External URL *</Label>
                <Input
                  id="external-url"
                  placeholder="https://... (YouTube, Google Drive, OneDrive, or any link)"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  data-testid="input-external-url"
                />
              </div>
            )}
            <div className="border-t pt-4 space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Initial Version Info</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="initial-version">Version Number</Label>
                  <Input
                    id="initial-version"
                    placeholder="e.g. 1.0"
                    value={form.versionNumber}
                    onChange={(e) => update({ versionNumber: e.target.value })}
                    data-testid="input-initial-version"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="release-notes">Release Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Textarea
                  id="release-notes"
                  rows={2}
                  placeholder="What's included in this initial version?"
                  value={form.releaseNotes}
                  onChange={(e) => update({ releaseNotes: e.target.value })}
                  data-testid="input-release-notes"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
            <CardDescription>Describe the resource and its academic context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" value={form.title} onChange={(e) => update({ title: e.target.value })} data-testid="input-title" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="shortDescription">Short Description</Label>
                <Input id="shortDescription" value={form.shortDescription} onChange={(e) => update({ shortDescription: e.target.value })} data-testid="input-short-description" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Full Description</Label>
                <Textarea id="description" rows={3} value={form.description} onChange={(e) => update({ description: e.target.value })} data-testid="input-description" />
              </div>
              <div className="space-y-2">
                <Label>Resource Type *</Label>
                <Select value={form.resourceType} onValueChange={(v) => update({ resourceType: v })}>
                  <SelectTrigger data-testid="select-resource-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESOURCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => update({ category: v })}>
                  <SelectTrigger data-testid="select-category"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="author">Author</Label>
                <Input id="author" value={form.author} onChange={(e) => update({ author: e.target.value })} data-testid="input-author" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="faculty">Faculty</Label>
                <Input id="faculty" value={form.faculty} onChange={(e) => update({ faculty: e.target.value })} data-testid="input-faculty" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keywords">Keywords (comma separated)</Label>
                <Input id="keywords" value={form.keywords} onChange={(e) => update({ keywords: e.target.value })} data-testid="input-keywords" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input id="tags" value={form.tags} onChange={(e) => update({ tags: e.target.value })} data-testid="input-tags" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Input id="language" value={form.language} onChange={(e) => update({ language: e.target.value })} data-testid="input-language" />
              </div>
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={form.difficulty} onValueChange={(v) => update({ difficulty: v })}>
                  <SelectTrigger data-testid="select-difficulty"><SelectValue placeholder="Select difficulty" /></SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />
            <p className="text-sm font-medium">Academic Context</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Library</Label>
                <Select value={form.libraryId} onValueChange={(v) => update({ libraryId: v })}>
                  <SelectTrigger data-testid="select-library"><SelectValue placeholder="Any library" /></SelectTrigger>
                  <SelectContent>
                    {libraries.map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input id="department" value={form.department} onChange={(e) => update({ department: e.target.value })} data-testid="input-department" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="program">Program</Label>
                <Input id="program" value={form.program} onChange={(e) => update({ program: e.target.value })} data-testid="input-program" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course">Course</Label>
                <Input id="course" value={form.course} onChange={(e) => update({ course: e.target.value })} data-testid="input-course" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" value={form.subject} onChange={(e) => update({ subject: e.target.value })} data-testid="input-subject" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="semester">Semester</Label>
                <Input id="semester" value={form.semester} onChange={(e) => update({ semester: e.target.value })} data-testid="input-semester" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="academicYear">Academic Year</Label>
                <Input id="academicYear" value={form.academicYear} onChange={(e) => update({ academicYear: e.target.value })} data-testid="input-academic-year" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="section">Section</Label>
                <Input id="section" value={form.section} onChange={(e) => update({ section: e.target.value })} data-testid="input-section" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch">Batch</Label>
                <Input id="batch" value={form.batch} onChange={(e) => update({ batch: e.target.value })} data-testid="input-batch" />
              </div>
            </div>

            <Separator />
            <p className="text-sm font-medium">Learning Details</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="credits">Credits</Label>
                <Input id="credits" type="number" value={form.credits} onChange={(e) => update({ credits: e.target.value })} data-testid="input-credits" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="readingTime">Est. Reading Time (min)</Label>
                <Input id="readingTime" type="number" value={form.estimatedReadingTimeMinutes} onChange={(e) => update({ estimatedReadingTimeMinutes: e.target.value })} data-testid="input-reading-time" />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="topics">Topics</Label>
                <Textarea id="topics" rows={2} value={form.topics} onChange={(e) => update({ topics: e.target.value })} data-testid="input-topics" />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="learningOutcomes">Learning Outcomes</Label>
                <Textarea id="learningOutcomes" rows={2} value={form.learningOutcomes} onChange={(e) => update({ learningOutcomes: e.target.value })} data-testid="input-learning-outcomes" />
              </div>
            </div>

            <Separator />
            <p className="text-sm font-medium">Search Attributes</p>
            <DigitalResourceAttributesEditor
              selectedValueIds={selectedAttributeIds}
              onChange={setSelectedAttributeIds}
            />
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Visibility & Access</CardTitle>
            <CardDescription>Control who can see and interact with this resource.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select value={form.visibility} onValueChange={(v) => update({ visibility: v })}>
                <SelectTrigger data-testid="select-visibility"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VISIBILITIES.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {form.visibility === "ROLE_BASED" && (
              <div className="space-y-2">
                <Label>Visible to Roles</Label>
                <div className="flex gap-2 flex-wrap">
                  {["ADMIN", "LIBRARIAN", "FACULTY", "STUDENT"].map(role => (
                    <Badge
                      key={role}
                      variant={form.visibleToRoles.includes(role) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleRole(role)}
                      data-testid={`chip-role-${role}`}
                    >
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="allow-download">Allow Download</Label>
                <p className="text-xs text-muted-foreground">Users can download the file directly</p>
              </div>
              <Switch id="allow-download" checked={form.allowDownload} onCheckedChange={(v) => update({ allowDownload: v })} data-testid="switch-allow-download" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="allow-preview">Allow In-Browser Preview</Label>
                <p className="text-xs text-muted-foreground">Users can view the file without downloading</p>
              </div>
              <Switch id="allow-preview" checked={form.allowPreview} onCheckedChange={(v) => update({ allowPreview: v })} data-testid="switch-allow-preview" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="publish-now">Publish Immediately</Label>
                <p className="text-xs text-muted-foreground">If off, the resource is saved as a draft</p>
              </div>
              <Switch id="publish-now" checked={form.publishNow} onCheckedChange={(v) => update({ publishNow: v })} data-testid="switch-publish-now" />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Submit</CardTitle>
            <CardDescription>Confirm the details before uploading.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Source: </span>{sourceMode === "file" ? (file?.name || "No file") : (externalUrl || "No URL")}</div>
              <div><span className="text-muted-foreground">Title: </span>{form.title}</div>
              <div><span className="text-muted-foreground">Type: </span>{form.resourceType}</div>
              <div><span className="text-muted-foreground">Category: </span>{form.category || "—"}</div>
              <div><span className="text-muted-foreground">Visibility: </span>{VISIBILITIES.find(v => v.value === form.visibility)?.label}</div>
              <div><span className="text-muted-foreground">Status: </span>{form.publishNow ? "Published" : "Draft"}</div>
              <div><span className="text-muted-foreground">Download: </span>{form.allowDownload ? "Allowed" : "Disabled"}</div>
              <div><span className="text-muted-foreground">Preview: </span>{form.allowPreview ? "Allowed" : "Disabled"}</div>
            </div>
            {selectedAttributeLabels.length > 0 && (
              <div>
                <span className="text-muted-foreground text-sm">Search Attributes: </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedAttributeLabels.map((a) => (
                    <Badge key={a.id} variant="secondary" className="text-xs">{a.label}</Badge>
                  ))}
                </div>
              </div>
            )}
            {form.tags && (
              <div className="flex flex-wrap gap-1">
                {form.tags.split(",").map(t => t.trim()).filter(Boolean).map(t => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={step === 0 ? () => setLocation("/digital-resources/repository") : goBack} data-testid="button-prev">
          <ArrowLeft className="h-4 w-4 mr-2" /> {step === 0 ? "Cancel" : "Back"}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            onClick={goNext}
            disabled={(step === 0 && !canProceedStep0) || (step === 1 && !canProceedStep1)}
            className="gap-2"
            data-testid="button-next"
          >
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="gap-2" data-testid="button-submit">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {createMutation.isPending ? "Uploading..." : "Upload Resource"}
          </Button>
        )}
      </div>
    </MainLayout>
  );
}
