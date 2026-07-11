import AsyncStorage from '@react-native-async-storage/async-storage';

export const GEOFENCE_STATE_KEY = 'WTRACKER_GEOFENCE_STATE';

export enum GeofenceState {
  OUTSIDE = 'OUTSIDE',
  ENTERING = 'ENTERING',
  INSIDE = 'INSIDE',
  EXITING = 'EXITING',
}

export type GeofenceEventName = 'Enter' | 'Exit';

export type GeofenceTransition = 'STAY' | 'ENTERED' | 'EXITED';

type StorageLike = Pick<
  typeof AsyncStorage,
  'getItem' | 'setItem' | 'removeItem'
>;

type SampleState = {
  state: GeofenceState;
  enterSamples: number;
  exitSamples: number;
};

const REQUIRED_SAMPLES = 3;

const getStateKey = (siteIdentifier: string): string => {
  return `${GEOFENCE_STATE_KEY}_${siteIdentifier}`;
};

const getSamplesKey = (siteIdentifier: string): string => {
  return `${GEOFENCE_STATE_KEY}_${siteIdentifier}_SAMPLES`;
};

export class LocationFSM {
  private storage: StorageLike;
  private mutex: Promise<void> = Promise.resolve();

  constructor(storage: StorageLike = AsyncStorage) {
    this.storage = storage;
  }

  async update(
    eventName: GeofenceEventName,
    siteIdentifier: string
  ): Promise<{ transition: GeofenceTransition; state: GeofenceState }> {
    return this.withLock(async () => {
      const current = await this.readSampleState(siteIdentifier);

      if (eventName === 'Enter') {
        return await this.handleEnter(siteIdentifier, current);
      }

      return await this.handleExit(siteIdentifier, current);
    });
  }

  async reset(siteIdentifiers?: string[]): Promise<void> {
    return this.withLock(async () => {
      if (!siteIdentifiers || siteIdentifiers.length === 0) {
        return;
      }

      await Promise.all(
        siteIdentifiers.flatMap((siteIdentifier) => [
          this.storage.removeItem(getStateKey(siteIdentifier)),
          this.storage.removeItem(getSamplesKey(siteIdentifier)),
        ])
      );
    });
  }

  private async handleEnter(
    siteIdentifier: string,
    current: SampleState
  ): Promise<{ transition: GeofenceTransition; state: GeofenceState }> {
    if (current.state === GeofenceState.INSIDE) {
      return {
        transition: 'STAY',
        state: GeofenceState.INSIDE,
      };
    }

    const next: SampleState = {
      state: GeofenceState.ENTERING,
      enterSamples: current.enterSamples + 1,
      exitSamples: 0,
    };

    if (next.enterSamples >= REQUIRED_SAMPLES) {
      const committed: SampleState = {
        state: GeofenceState.INSIDE,
        enterSamples: 0,
        exitSamples: 0,
      };

      await this.writeSampleState(siteIdentifier, committed);

      return {
        transition: 'ENTERED',
        state: GeofenceState.INSIDE,
      };
    }

    await this.writeSampleState(siteIdentifier, next);

    return {
      transition: 'STAY',
      state: GeofenceState.ENTERING,
    };
  }

  private async handleExit(
    siteIdentifier: string,
    current: SampleState
  ): Promise<{ transition: GeofenceTransition; state: GeofenceState }> {
    if (current.state === GeofenceState.OUTSIDE) {
      return {
        transition: 'STAY',
        state: GeofenceState.OUTSIDE,
      };
    }

    const next: SampleState = {
      state: GeofenceState.EXITING,
      enterSamples: 0,
      exitSamples: current.exitSamples + 1,
    };

    if (next.exitSamples >= REQUIRED_SAMPLES) {
      const committed: SampleState = {
        state: GeofenceState.OUTSIDE,
        enterSamples: 0,
        exitSamples: 0,
      };

      await this.writeSampleState(siteIdentifier, committed);

      return {
        transition: 'EXITED',
        state: GeofenceState.OUTSIDE,
      };
    }

    await this.writeSampleState(siteIdentifier, next);

    return {
      transition: 'STAY',
      state: GeofenceState.EXITING,
    };
  }

  private async readSampleState(siteIdentifier: string): Promise<SampleState> {
    const stateRaw = await this.storage.getItem(getStateKey(siteIdentifier));
    const samplesRaw = await this.storage.getItem(getSamplesKey(siteIdentifier));

    const state = this.parseGeofenceState(stateRaw);
    const samples = this.parseSamples(samplesRaw);

    return {
      state,
      enterSamples: samples.enterSamples,
      exitSamples: samples.exitSamples,
    };
  }

  private async writeSampleState(
    siteIdentifier: string,
    value: SampleState
  ): Promise<void> {
    await Promise.all([
      this.storage.setItem(getStateKey(siteIdentifier), value.state),
      this.storage.setItem(
        getSamplesKey(siteIdentifier),
        JSON.stringify({
          enterSamples: value.enterSamples,
          exitSamples: value.exitSamples,
        })
      ),
    ]);
  }

  private parseGeofenceState(raw: string | null): GeofenceState {
    if (
      raw === GeofenceState.OUTSIDE ||
      raw === GeofenceState.ENTERING ||
      raw === GeofenceState.INSIDE ||
      raw === GeofenceState.EXITING
    ) {
      return raw;
    }

    return GeofenceState.OUTSIDE;
  }

  private parseSamples(raw: string | null): {
    enterSamples: number;
    exitSamples: number;
  } {
    if (!raw) {
      return {
        enterSamples: 0,
        exitSamples: 0,
      };
    }

    try {
      const parsed = JSON.parse(raw) as Partial<{
        enterSamples: number;
        exitSamples: number;
      }>;

      return {
        enterSamples:
          typeof parsed.enterSamples === 'number' ? parsed.enterSamples : 0,
        exitSamples:
          typeof parsed.exitSamples === 'number' ? parsed.exitSamples : 0,
      };
    } catch {
      return {
        enterSamples: 0,
        exitSamples: 0,
      };
    }
  }

  private async withLock<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.mutex;
    let release!: () => void;

    this.mutex = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      return await work();
    } finally {
      release();
    }
  }
}

