/**
 * Project Index Manager with Multi-Project Support
 *
 * Manages the lifecycle of the project indexer for Boomerang.
 * Uses WorkspaceManager for project isolation.
 */

import { BuiltInMemory, ProjectMemoryConfig } from './built-in-memory.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';

export interface WorkspaceConfig {
  version: string;
  activeProject: string | null;
  projects: Record<string, {
    path: string;
    memoryPath: string;
    indexPath: string;
    config: {
      excludePatterns: string[];
      chunkSize: number;
      chunkOverlap?: number;
      maxFileSize?: number;
    };
  }>;
}

export interface ProjectStatus {
  name: string;
  path: string;
  initialized: boolean;
  indexed: boolean;
  indexedFiles: number;
  totalChunks: number;
  status: string;
  error?: string;
}

const DEFAULT_WORKSPACE_PATH = join(homedir(), '.boomerang', 'workspace.json');

export class WorkspaceManager {
  private static instance: WorkspaceManager;
  private workspace: WorkspaceConfig | null = null;
  private workspacePath: string = DEFAULT_WORKSPACE_PATH;
  private projectMemories: Map<string, BuiltInMemory> = new Map();
  private activeProject: string | null = null;

  static getInstance(): WorkspaceManager {
    if (!WorkspaceManager.instance) {
      WorkspaceManager.instance = new WorkspaceManager();
    }
    return WorkspaceManager.instance;
  }

  async loadWorkspace(workspacePath?: string): Promise<void> {
    this.workspacePath = workspacePath || DEFAULT_WORKSPACE_PATH;

    try {
      if (existsSync(this.workspacePath)) {
        const data = readFileSync(this.workspacePath, 'utf-8');
        this.workspace = JSON.parse(data);
      } else {
        await this.createDefaultWorkspace();
      }

      if (this.workspace?.activeProject) {
        await this.switchProject(this.workspace.activeProject);
      }
    } catch (error) {
      console.error('Failed to load workspace:', error);
      await this.createDefaultWorkspace();
    }
  }

  private async createDefaultWorkspace(): Promise<void> {
    const cwd = process.cwd();
    const projectName = this.inferProjectName(cwd);

    this.workspace = {
      version: '1.0',
      activeProject: projectName,
      projects: {
        [projectName]: this.createProjectConfig(projectName, cwd),
      },
    };

    await this.saveWorkspace();
    await this.initializeProject(projectName);
  }

  private createProjectConfig(_name: string, projectPath: string) {
    const resolvedPath = resolve(projectPath);
    const boomerangDir = join(resolvedPath, '.boomerang');
    return {
      path: resolvedPath,
      memoryPath: join(boomerangDir, 'memory'),
      indexPath: join(boomerangDir, 'index'),
      config: {
        excludePatterns: ['node_modules', '.git', 'dist', 'build', '.next'],
        chunkSize: 512,
        chunkOverlap: 50,
        maxFileSize: 1024 * 1024,
      },
    };
  }

  private inferProjectName(projectPath: string): string {
    const parts = projectPath.split(/[/\\]/);
    const name = parts[parts.length - 1] || 'default';
    return name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }

  async saveWorkspace(): Promise<void> {
    if (!this.workspace) return;
    const dir = this.workspacePath.substring(0, this.workspacePath.lastIndexOf('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.workspacePath, JSON.stringify(this.workspace, null, 2));
  }

  async addProject(name: string, projectPath: string): Promise<void> {
    if (!this.workspace) throw new Error('Workspace not loaded');
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (this.workspace.projects[sanitizedName]) {
      throw new Error(`Project '${sanitizedName}' already exists`);
    }
    this.workspace.projects[sanitizedName] = this.createProjectConfig(sanitizedName, projectPath);
    await this.saveWorkspace();
    await this.initializeProject(sanitizedName);
  }

  async removeProject(name: string): Promise<void> {
    if (!this.workspace) throw new Error('Workspace not loaded');
    const memory = this.projectMemories.get(name);
    if (memory) {
      await memory.shutdown();
      this.projectMemories.delete(name);
    }
    delete this.workspace.projects[name];
    if (this.workspace.activeProject === name) {
      const remaining = Object.keys(this.workspace.projects);
      this.workspace.activeProject = remaining.length > 0 ? remaining[0] : null;
      if (this.workspace.activeProject) {
        await this.switchProject(this.workspace.activeProject);
      }
    }
    await this.saveWorkspace();
  }

  async switchProject(name: string): Promise<void> {
    if (!this.workspace) throw new Error('Workspace not loaded');
    if (!this.workspace.projects[name]) throw new Error(`Project '${name}' not found`);
    await this.initializeProject(name);
    this.activeProject = name;
    this.workspace.activeProject = name;
    await this.saveWorkspace();
  }

  private async initializeProject(name: string): Promise<void> {
    if (!this.workspace) return;
    const project = this.workspace.projects[name];
    if (!project) return;
    if (this.projectMemories.has(name)) return;

    try {
      mkdirSync(project.memoryPath, { recursive: true });
      mkdirSync(project.indexPath, { recursive: true });

      const memory = new BuiltInMemory();
      const config: ProjectMemoryConfig = {
        memoryPath: project.memoryPath,
        indexPath: project.indexPath,
        excludePatterns: project.config.excludePatterns,
        chunkSize: project.config.chunkSize,
        chunkOverlap: project.config.chunkOverlap,
        maxFileSize: project.config.maxFileSize,
      };
      await memory.initialize(project.path, config);
      this.projectMemories.set(name, memory);
    } catch (error) {
      console.error(`Failed to initialize project ${name}:`, error);
      throw error;
    }
  }

  getActiveProject() {
    if (!this.workspace || !this.activeProject) return null;
    return this.workspace.projects[this.activeProject] || null;
  }

  getActiveProjectName(): string | null {
    return this.activeProject;
  }

  getProject(name: string) {
    if (!this.workspace) return null;
    return this.workspace.projects[name] || null;
  }

  listProjects(): string[] {
    if (!this.workspace) return [];
    return Object.keys(this.workspace.projects);
  }

  getActiveMemory(): BuiltInMemory | null {
    if (!this.activeProject) return null;
    return this.projectMemories.get(this.activeProject) || null;
  }

  getProjectMemory(name: string): BuiltInMemory | null {
    return this.projectMemories.get(name) || null;
  }

  getStatus() {
    if (!this.workspace) {
      return {
        loaded: false,
        workspacePath: this.workspacePath,
        activeProject: null,
        projects: [] as string[],
        projectStatuses: {} as Record<string, ProjectStatus>,
      };
    }

    const projectStatuses: Record<string, ProjectStatus> = {};
    for (const [name, project] of Object.entries(this.workspace.projects)) {
      const memory = this.projectMemories.get(name);
      const memStatus = memory?.getStatus();
      projectStatuses[name] = {
        name,
        path: project.path,
        initialized: !!memory,
        indexed: memStatus?.modelLoaded || false,
        indexedFiles: memStatus?.indexedFiles || 0,
        totalChunks: memStatus?.totalChunks || 0,
        status: memStatus?.status || 'idle',
        error: memStatus?.error,
      };
    }

    return {
      loaded: true,
      workspacePath: this.workspacePath,
      activeProject: this.activeProject,
      projects: this.listProjects(),
      projectStatuses,
    };
  }

  async searchAllProjects(query: string, topK: number = 5) {
    const results: Array<{
      project: string;
      projectPath: string;
      results: any[];
      count: number;
    }> = [];

    for (const [name, memory] of this.projectMemories) {
      try {
        const project = this.workspace?.projects[name];
        if (!project) continue;
        const projectResults = await memory.searchProject(query, topK);
        if (projectResults.length > 0) {
          results.push({
            project: name,
            projectPath: project.path,
            results: projectResults,
            count: projectResults.length,
          });
        }
      } catch (error) {
        console.warn(`Search failed for project ${name}:`, error);
      }
    }
    return results;
  }

  async shutdown(): Promise<void> {
    for (const [name, memory] of this.projectMemories) {
      try {
        await memory.shutdown();
      } catch (error) {
        console.error(`Failed to shutdown project ${name}:`, error);
      }
    }
    this.projectMemories.clear();
    this.activeProject = null;
    this.workspace = null;
  }

  getWorkspaceConfig(): WorkspaceConfig | null {
    return this.workspace;
  }
}

// ============================================================================
// Project Index Manager - delegates to WorkspaceManager
// ============================================================================

let workspaceManagerInstance: WorkspaceManager | null = null;

export async function initializeProjectIndexManager(projectPath?: string): Promise<void> {
  workspaceManagerInstance = WorkspaceManager.getInstance();
  await workspaceManagerInstance.loadWorkspace();

  if (projectPath && !workspaceManagerInstance.getActiveProject()) {
    const projectName = workspaceManagerInstance.listProjects()[0] || 'default';
    if (!workspaceManagerInstance.getProject(projectName)) {
      await workspaceManagerInstance.addProject(projectName, projectPath);
    }
    await workspaceManagerInstance.switchProject(projectName);
  }
}

export function getProjectIndexStatus() {
  const manager = WorkspaceManager.getInstance();
  const status = manager.getStatus();
  const activeStatus = status.activeProject ? status.projectStatuses[status.activeProject] : null;
  return {
    indexedFiles: activeStatus?.indexedFiles || 0,
    totalChunks: activeStatus?.totalChunks || 0,
    status: activeStatus?.status || 'not_initialized',
    modelLoaded: activeStatus?.indexed || false,
    error: activeStatus?.error,
  };
}

export async function searchProjectFiles(query: string, limit?: number): Promise<{ success: boolean; results?: any[]; error?: string }> {
  try {
    const manager = WorkspaceManager.getInstance();
    const memory = manager.getActiveMemory();
    if (!memory) {
      return { success: false, error: 'No active project' };
    }
    const results = await memory.searchProject(query, limit || 10);
    return { success: true, results };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function isProjectIndexManagerInitialized(): boolean {
  const manager = WorkspaceManager.getInstance();
  return manager.getStatus().loaded;
}

export function getWorkspaceManager(): WorkspaceManager {
  return WorkspaceManager.getInstance();
}
