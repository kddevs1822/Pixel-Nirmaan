import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

export const getProjects = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projects = await prisma.project.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        description: true,
        folder: true,
        outputPath: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.status(200).json({ projects });
  } catch (error: any) {
    console.error('Error fetching projects:', error);
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

export const getProjectById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const id = String(req.params.id);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const project = await prisma.project.findFirst({
      where: { id, userId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.status(200).json({ project });
  } catch (error: any) {
    console.error('Error fetching project:', error);
    return res.status(500).json({ error: 'Failed to fetch project' });
  }
};

export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, folder, description, outputPath, nodes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        folder: folder && folder.trim() ? folder.trim() : 'General',
        description: description || null,
        outputPath: outputPath || null,
        nodes: nodes || [],
        userId,
      },
    });

    return res.status(201).json({ project });
  } catch (error: any) {
    console.error('Error creating project:', error);
    return res.status(500).json({ error: 'Failed to create project' });
  }
};

export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const id = String(req.params.id);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, folder, description, outputPath, nodes } = req.body;

    const dataToUpdate: any = {};
    if (name !== undefined) dataToUpdate.name = name.trim();
    if (folder !== undefined) dataToUpdate.folder = folder.trim() || 'General';
    if (description !== undefined) dataToUpdate.description = description;
    if (outputPath !== undefined) dataToUpdate.outputPath = outputPath;
    if (nodes !== undefined) dataToUpdate.nodes = nodes;

    const result = await prisma.project.updateMany({
      where: { id, userId },
      data: dataToUpdate,
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Project not found or not owned by user' });
    }

    return res.status(200).json({ message: 'Project updated successfully' });
  } catch (error: any) {
    console.error('Error updating project:', error);
    return res.status(500).json({ error: 'Failed to update project' });
  }
};

export const deleteProject = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const id = String(req.params.id);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await prisma.project.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Project not found or not owned by user' });
    }

    return res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting project:', error);
    return res.status(500).json({ error: 'Failed to delete project' });
  }
};
