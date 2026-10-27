import * as Device from 'expo-device';
import { availableModels, type ModelId } from './models';

export const deviceModels = () =>
  availableModels({ totalMemory: Device.totalMemory, abis: Device.supportedCpuArchitectures });

export const isModelAllowed = (id: ModelId) => deviceModels().some((m) => m.id === id && m.allowed);
