import type { Geometry } from 'geojson';
import { DiplomaticRelation, Nation, Territory } from '../../types/game';

export interface GeoCountryFeature {
  type: 'Feature';
  id: string;
  properties: {
    name: string;
  };
  geometry: Geometry;
}

export interface InitialWorldBundle {
  features: GeoCountryFeature[];
  nations: Record<string, Nation>;
  territories: Record<string, Territory>;
  relations: Record<string, DiplomaticRelation>;
}
