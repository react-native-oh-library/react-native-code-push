import { CodePushConstants } from "./CodePushConstants";
import dataPreferences from '@ohos.data.preferences';
import { BusinessError } from "@ohos.base";
import HashMap from '@ohos.util.HashMap';
import { CodePushUnknownException } from './CodePushUnknownException';
import { CodePushMalformedDataException } from './CodePushMalformedDataException';
import common from '@ohos.app.ability.common';

declare function getContext(context: any): common.UIAbilityContext;

let context = getContext(this) as common.UIAbilityContext;
let getpreferences: dataPreferences.Preferences | null = null;
dataPreferences.getPreferences(context, CodePushConstants.CODE_PUSH_PREFERENCES,
  (err: BusinessError, val: dataPreferences.Preferences) => {
    if (err) {
      console.error("Failed to get preferences. code =" + err.code + ", message =" + err.message);
      return;
    }
    getpreferences = val;
    console.info("Succeeded in getting preferences.");
  })

export class SettingsManager {
  private preferences: dataPreferences.Preferences | null = getpreferences;

  public getFailedUpdates(): Array<HashMap<string, any>> {
    console.log('isFailedHash--getFailedUpdates entry')
    let failedUpdatesString = this.preferences.getSync(CodePushConstants.FAILED_UPDATES_KEY, null) as string;
    console.log('isFailedHash--getFailedUpdates failedUpdatesString', failedUpdatesString)
    if (failedUpdatesString === null) {
      return new Array();
    }
    try {
      return JSON.parse(failedUpdatesString);
    } catch (e) {
      console.log('isFailedHash--getFailedUpdates catch')
      // Unrecognized data format, clear and replace with expected format.
      const emptyArray: Array<HashMap<string, any>> = new Array();
      this.preferences.put(CodePushConstants.FAILED_UPDATES_KEY, emptyArray.toString());
      return emptyArray;
    }
  }

  public getPendingUpdate(): HashMap<string, any> | null {
    const pendingUpdateString: string | null =
      this.preferences.getSync(CodePushConstants.PENDING_UPDATE_KEY, null) as string;
    console.log('installPackage--pendingUpdateString' + pendingUpdateString)
    if (pendingUpdateString === null) {
      return null;
    }

    try {
      return JSON.parse(pendingUpdateString);
    } catch (e) {
      // Should not happen.
      console.log(CodePushConstants.REACT_NATIVE_LOG_TAG,
        "[CodePush] " + "Unable to parse pending update metadata " + pendingUpdateString +
          " stored in SharedPreferences");
      return null;
    }
  }

  public isFailedHash(packageHash: string): boolean {
    const failedUpdates: Array<HashMap<string, any>> | null = this.getFailedUpdates();
    console.log('isFailedHash--failedUpdates', failedUpdates)
    if (failedUpdates !== null && packageHash !== null) {
      for (let i = 0; i < failedUpdates.length; i++) {
        console.log('isFailedHash--failedUpdates-i', failedUpdates[i])
        try {
          const failedPackage: HashMap<string, any> = failedUpdates[i];
          const failedPackageHash: string = JSON.stringify(failedPackage.get(CodePushConstants.PACKAGE_HASH_KEY));
          console.log('isFailedHash--failedPackageHash', failedPackageHash)
          if (packageHash === failedPackageHash) {
            console.log('isFailedHash--true')
            return true;
          }
        } catch (e) {
          throw new CodePushUnknownException("Unable to read failedUpdates data stored in SharedPreferences.", e);
        }
      }
    }
    return false;
  }

  public isPendingUpdate(packageHash: string | null): boolean {
    console.log('installPackage--isPendingUpdate-entry' + JSON.stringify(this.preferences))
    const pendingUpdate: HashMap<string, any> = this.getPendingUpdate();
    console.log('installPackage--pendingUpdate=' + pendingUpdate)
    try {
      return pendingUpdate != null &&
        !pendingUpdate[CodePushConstants.PENDING_UPDATE_IS_LOADING_KEY] &&
        (packageHash == null ||
          (pendingUpdate[CodePushConstants.PENDING_UPDATE_HASH_KEY] as unknown as string) === packageHash);
    } catch (e) {
      throw new CodePushUnknownException("Unable to read pending update metadata in isPendingUpdate.", e);
    }
  }

  public removeFailedUpdates(): void {
    this.preferences.delete(CodePushConstants.FAILED_UPDATES_KEY);
  }

  public removePendingUpdate(): void {
    this.preferences.delete(CodePushConstants.PENDING_UPDATE_KEY);
  }

  public saveFailedUpdate(failedPackage: HashMap<string, any>): void {
    try {
      if (this.isFailedHash(failedPackage.get(CodePushConstants.PACKAGE_HASH_KEY) as unknown as string)) {
        // Do not need to add the package if it is already in the failedUpdates.
        return;
      }
    } catch (e) {
      throw new CodePushUnknownException("Unable to read package hash from package.", e);
    }

    const failedUpdatesString: string | null =
      this.preferences.getSync(CodePushConstants.FAILED_UPDATES_KEY, null) as string;
    let failedUpdates: Array<HashMap<string, any>>;
    if (failedUpdatesString == null) {
      failedUpdates = [];
    } else {
      try {
        failedUpdates = JSON.parse(failedUpdatesString);
      } catch (e) {
        // Should not happen.
        throw new CodePushMalformedDataException("Unable to parse failed updates information " +
          failedUpdatesString + " stored in SharedPreferences", e);
      }
    }

    failedUpdates.push(failedPackage);
    this.preferences.put(CodePushConstants.FAILED_UPDATES_KEY, failedUpdates.toString());
  }

  public getLatestRollbackInfo(): HashMap<string, any> | null {
    const latestRollbackInfoString =
      this.preferences.getSync(CodePushConstants.LATEST_ROLLBACK_INFO_KEY, null) as string;
    if (!latestRollbackInfoString) {
      return null;
    }

    try {
      return JSON.parse(latestRollbackInfoString);
    } catch (error) {
      console.error("Unable to parse latest rollback metadata " + latestRollbackInfoString +
        " stored in SharedPreferences");
      return null;
    }
  }

  public setLatestRollbackInfo(packageHash: string): void {
    let latestRollbackInfo: HashMap<string, any> = this.getLatestRollbackInfo();
    let count = 0;

    if (latestRollbackInfo) {
      const latestRollbackPackageHash = latestRollbackInfo.get(CodePushConstants.LATEST_ROLLBACK_PACKAGE_HASH_KEY);
      if (latestRollbackPackageHash === packageHash) {
        count = latestRollbackInfo.get(CodePushConstants.LATEST_ROLLBACK_COUNT_KEY) as number;
      }
    } else {
      latestRollbackInfo = new HashMap();
    }

    try {
      latestRollbackInfo.set(CodePushConstants.LATEST_ROLLBACK_PACKAGE_HASH_KEY, packageHash);
      latestRollbackInfo.set(CodePushConstants.LATEST_ROLLBACK_TIME_KEY, Date.now());
      latestRollbackInfo.set(CodePushConstants.LATEST_ROLLBACK_COUNT_KEY, count + 1);
      this.preferences.put(CodePushConstants.LATEST_ROLLBACK_INFO_KEY, JSON.stringify(latestRollbackInfo));
    } catch (error) {
      throw new CodePushUnknownException("Unable to save latest rollback info.", error);
    }
  }

  public savePendingUpdate(packageHash: string, isLoading: boolean): void {
    const pendingUpdate: object = {};
    pendingUpdate[CodePushConstants.PENDING_UPDATE_HASH_KEY] = packageHash;
    pendingUpdate[CodePushConstants.PENDING_UPDATE_IS_LOADING_KEY] = isLoading;
    try {
      console.log('installPackage--pendingUpdate', pendingUpdate)
      this.preferences.put(CodePushConstants.PENDING_UPDATE_KEY, JSON.stringify(pendingUpdate));
    } catch (error) {
      throw new CodePushUnknownException("Unable to save pending update.", error);
    }
  }
}
