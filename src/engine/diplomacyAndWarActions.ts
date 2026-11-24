// Facade barrel preserving backward-compatible imports while delegating to single-responsibility diplomacy & war modules.
export { applyConquestDiplomaticPenalty } from './core/diplomacyHelpers';
export type { DomainActionPatch } from './actions/diplomacyActionHelpers';
export * from './actions/diplomaticActions';
export * from './actions/warActions';
export * from './actions/peaceActions';
export * from './actions/territorialDiplomacyActions';
