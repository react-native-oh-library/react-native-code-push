import { CodePushConstants } from './CodePushConstants';
import { UITurboModule, UITurboModuleContext } from '@rnoh/react-native-openharmony/ts';
import dataPreferences from '@ohos.data.preferences';
import { CodePushUpdateUtils } from './CodePushUpdateUtils';
import { CodePushUpdateManager } from './CodePushUpdateManager';
import { CodePushTelemetryManager } from './CodePushTelemetryManager';
import { CodePush } from './CodePush';
import common from '@ohos.app.ability.common';
import fs, { ListFileOptions } from '@ohos.file.fs';
import { SettingsManager } from './SettingsManager';
import { BusinessError } from '@kit.BasicServicesKit';
import { CodePushUtils } from './CodePushUtils';
import { CodePushUpdateState } from './CodePushUpdateState';
import { CodePushMalformedDataException } from './CodePushMalformedDataException';
import { CodePushUnknownException } from './CodePushUnknownException';
import { TM } from '@rnoh/react-native-openharmony/generated/ts';
import { window } from '@kit.ArkUI';

import Logger from './Logger';

const TAG = 'CodePushNativeModule: '

declare function getContext(context: any): common.UIAbilityContext;

let context = getContext(this) as common.UIAbilityContext;

function generateUUID(): string {
  let uuid = '';
  const chars = '0123456789abcdef';

  for (let i = 0; i < 32; i++) {
    const rnd = Math.floor(Math.random() * chars.length);
    uuid += chars[rnd];
    if (i === 7 || i === 11 || i === 15 || i === 19) {
      uuid += '-';
    }
  }
  Logger.info(TAG, `generateUUID uuid = ${uuid}`);
  return uuid;
}

export class CodePushNativeModule extends UITurboModule implements TM.RTNCodePush.Spec {
  private mBinaryContentsHash: string = "";
  private mClientUniqueId: string = "";
  private mCodePush: CodePush | null = null;
  private _restartQueue: boolean[] = [];
  private preferences: dataPreferences.Preferences | null = null;
  private mTelemetryManager: CodePushTelemetryManager | null = null;
  private mSettingsManager: SettingsManager | null = null;
  private mUpdateManager: CodePushUpdateManager | null = null;
  private installMode: number = -1;
  private ready: boolean = false;

  sync(): Promise<unknown> {
    throw new Error('Method not implemented.');
  }

  constructor(rnContext: UITurboModuleContext, codePush: CodePush) {
    super(rnContext);
    Logger.info(TAG, `constructor start`)
    this.mTelemetryManager = new CodePushTelemetryManager(context);
    this.mSettingsManager = new SettingsManager()
    dataPreferences.getPreferences(context, CodePushConstants.CODE_PUSH_PREFERENCES,
      (err: BusinessError, val: dataPreferences.Preferences) => {
        if (err) {
          Logger.error(TAG, `Failed to get preferences.error: ${JSON.stringify(err)}`);
          return;
        }
        this.preferences = val;
        Logger.info(TAG, "Succeeded in getting preferences.");
        this.mClientUniqueId = this.preferences?.getSync(CodePushConstants.CLIENT_UNIQUE_ID_KEY, null) as string;
        Logger.info(TAG, `mClientUniqueId: ${this.mClientUniqueId}`);
        if (this.mClientUniqueId == null) {
          this.mClientUniqueId = generateUUID();
          this.preferences.put(CodePushConstants.CLIENT_UNIQUE_ID_KEY, this.mClientUniqueId);
        }
      })
    this.mCodePush = codePush;
    // Initialize module state while we have a reference to the current context.
    this.mBinaryContentsHash = CodePushUpdateUtils.getHashForBinaryContents(context, this.mCodePush.isDebugMode());
    Logger.info(TAG, `getHashForBinaryContents mBinaryContentsHash: ${this.mBinaryContentsHash}`);
    Logger.info(TAG, `constructor end`)
  }

  async downloadUpdate(updatePackage: Record<string, any>, notifyProgress: boolean): Promise<void> {
    Logger.info(TAG, `downloadUpdate, updatePackage: ${JSON.stringify(updatePackage)}`)
    let mutableUpdatePackage: Record<string, any> = updatePackage;
    mutableUpdatePackage[CodePushConstants.BINARY_MODIFIED_TIME_KEY] = 0
    let bundleFileName: string = 'bundle.harmony.js';

    return new CodePushUpdateManager('').downloadPackage(mutableUpdatePackage, bundleFileName, this.ctx.httpClient,
      (totalBytes, receivedBytes) => {
        this.ctx.rnInstance.emitDeviceEvent('CodePushDownloadProgress', {
          totalBytes: totalBytes,
          receivedBytes: receivedBytes,
        });
      }, '')

  }

  async isFailedUpdate(packageHash: string): Promise<boolean> {
    try {
      return this.mSettingsManager.isFailedHash(packageHash);
    } catch (CodePushUnknownException) {
      Logger.error(TAG, `isFailedUpdate error: ${JSON.stringify(CodePushUnknownException)}`)
      return CodePushUnknownException;
    }
  }

  async getConfiguration(): Promise<object> {
    Logger.info(TAG, `getConfiguration start`);

    interface ConfigMap {
      appVersion: string,
      clientUniqueId: string,
      deploymentKey: string,
      serverUrl: string,
      packageHash?: string
    }

    let configMap: ConfigMap = {
      appVersion: this.mCodePush?.getAppVersion(),
      clientUniqueId: this.mClientUniqueId,
      deploymentKey: this.mCodePush?.getDeploymentKey(),
      serverUrl: this.mCodePush?.getServerUrl()
    };
    if (this.mBinaryContentsHash != null) {
      configMap[CodePushConstants.PACKAGE_HASH_KEY] = this.mBinaryContentsHash
    }
    Logger.info(TAG, `getConfiguration configMap: ${JSON.stringify(configMap)}`);
    return new Promise((resolve) => {
      resolve(configMap)
    })
  }

  async getUpdateMetadata(updateState: number) {
    return this.doInBackgroundForUpdateMetadata(updateState);
  }

  async doInBackgroundForUpdateMetadata(updateState: number) {
    Logger.info(TAG, `doInBackgroundForUpdateMetadata updateState=${updateState}`);
    try {
      let currentPackage = new CodePushUpdateManager('').getCurrentPackage();
      if (!currentPackage) {
        Logger.info(TAG, `currentPackage is empty`);
        return null;
      }

      let currentUpdateIsPending: boolean = false;
      if (currentPackage[CodePushConstants.PACKAGE_HASH_KEY]) {
        Logger.info(TAG, `currentPackage hasKey packageHash`);
        let currentHash = currentPackage[CodePushConstants.PACKAGE_HASH_KEY] as string;
        currentUpdateIsPending = this.mSettingsManager.isPendingUpdate(currentHash);
      }

      if (updateState == CodePushUpdateState.PENDING.valueOf() && !currentUpdateIsPending) {
        // The caller wanted a pending update
        // but there isn't currently one.
        return null;
      } else if (updateState == CodePushUpdateState.RUNNING.valueOf() && currentUpdateIsPending) {
        // The caller wants the running update, but the current
        // one is pending, so we need to grab the previous.

        // let previousPackage = new CodePushUpdateManager('').getPreviousPackage();

        // if (previousPackage == null) {
        //   Logger.info(TAG, `currentPackage previousPackage is null`);
        //   return null;
        // }

        // return previousPackage;
        let previousPackage = new CodePushUpdateManager('').getCurrentPackageInfo();
        const packageHash = {
          packageHash:previousPackage['previousPackage']
        }
        Logger.info(TAG, `doInBackgroundForUpdateMetadata previousPackage=${packageHash}`);
        return packageHash
      } else {
        if (this.mCodePush.isRunningBinaryVersion()) {
          currentPackage["_isDebugOnly"] = true;
        }
        // Enable differentiating pending vs. non-pending updates
        currentPackage["isPending"] = currentUpdateIsPending;
        Logger.info(TAG, `currentPackage currentPackage=${JSON.stringify(currentPackage)}`);
        return currentPackage;
      }
    } catch (e) {
      // We need to recover the app in case 'codepush.json' is corrupted
      if (e instanceof CodePushMalformedDataException) {
        CodePushUtils.log(e.message);
        this.clearUpdates();
        return Promise.resolve(null);
      } else if (e instanceof CodePushUnknownException) {
        CodePushUtils.log(e.message);
        return Promise.reject(e);
      }
    }
  }

  async getNewStatusReport(): Promise<object> {
    this.mUpdateManager == null && (this.mUpdateManager = new CodePushUpdateManager(''))
    try {
      if (this.mCodePush.needToReportRollback()) {
        this.mCodePush.setNeedToReportRollback(false);
        let failedUpdates = this.mSettingsManager.getFailedUpdates();
        if (failedUpdates != null && failedUpdates.length > 0) {
          try {
            let lastFailedPackage = failedUpdates[failedUpdates.length - 1];
            let failedStatusReport = this.mTelemetryManager.getRollbackReport(lastFailedPackage);
            if (failedStatusReport != null) {
              return Promise.resolve(failedStatusReport);
            }
          } catch (err) {
            throw new CodePushUnknownException("Unable to read failed updates information stored in SharedPreferences.",
              err);
          }
        }
      } else if (this.mCodePush.didUpdate()) {
        let currentPackage = this.mUpdateManager.getCurrentPackage();
        Logger.info(TAG, `getNewStatusReport currentPackage: ${JSON.stringify(currentPackage)}`);
        if (currentPackage != null) {
          let newPackageStatusReport =
            this.mTelemetryManager.getUpdateReport(currentPackage);
          Logger.info(TAG, `newPackageStatusReport: ${JSON.stringify(newPackageStatusReport)}`);
          if (newPackageStatusReport != null) {
            return Promise.resolve(newPackageStatusReport);
          }
        }
      } else if (this.mCodePush.isRunningBinaryVersion()) {
        let newAppVersionStatusReport = this.mTelemetryManager.getBinaryUpdateReport(this.mCodePush.getAppVersion());
        if (newAppVersionStatusReport != null) {
          Promise.resolve(newAppVersionStatusReport);
          return null;
        }
      } else {
        let retryStatusReport = this.mTelemetryManager.getRetryStatusReport();
        Logger.info(TAG, `retryStatusReport: ${JSON.stringify(retryStatusReport)}`);
        if (retryStatusReport != null) {
          return Promise.resolve(retryStatusReport);
        }
      }
      Promise.resolve("");
    } catch (err) {
      CodePushUtils.log(err);
      Promise.reject(err);
    }
    return null;
  }

  async installUpdate(updatePackage: Record<string, any>, installMode: number,
    minimumBackgroundDuration: number): Promise<void> {

    try {
      this.installMode = installMode
      this.ctx.uiAbilityContext.windowStage.on('windowStageEvent', (data) => {
        if(data === window.WindowStageEventType.SHOWN) {
          Logger.info(TAG, `Switch to foreground：${this.installMode}`)
          if(this.installMode === 2 && this.ready === true) {
            this.ctx.devToolsController.eventEmitter.emit("RELOAD", { reason: 'HotReload2' })
          }
        }

        if(data === window.WindowStageEventType.HIDDEN) {
          Logger.info(TAG, `Switch to background：${this.installMode}`)
          if(this.installMode === 3 && this.ready === true) {
            this.ctx.devToolsController.eventEmitter.emit("RELOAD", { reason: 'HotReload2' })
          }
        }

        Logger.info(TAG, 'Succeeded in enabling the listener for window stage event changes. Data: ' +
        JSON.stringify(data));
      });
      Logger.info(TAG, 'installPackage--CodePushNativeModule-entry')
      new CodePushUpdateManager('').installPackage(updatePackage, this.mSettingsManager.isPendingUpdate(null))
      Logger.info(TAG, 'installPackage--CodePushNativeModule-end')
      let pendingHash = updatePackage[CodePushConstants.PACKAGE_HASH_KEY];
      if (pendingHash == null) {
        throw new CodePushUnknownException("Update package to be installed has no hash.");
      } else {
        this.mSettingsManager.savePendingUpdate(pendingHash, /* isLoading */false);
      }
      Logger.info(TAG, `installPackage--CodePushNativeModule-end3=${installMode},CodePushInstallMode.IMMEDIATE`);

      Promise.resolve("");
    } catch (err) {
      CodePushUtils.log(err);
      Promise.reject(err);
    }
    return null;
  }

  async disallow() {
    return new Promise((resolve) => {
      Logger.info(TAG, "Disallowing restarts");
      resolve(null);
    })
  }

  async clearPendingRestart() {
    return new Promise((resolve) => {
      this._restartQueue = [];
      resolve(null);
    })
  }

  async restartApp(onlyIfUpdateIsPending: boolean) {
    try {
      this.restartAppInternal(onlyIfUpdateIsPending);
      return null
    } catch (e) {
      Logger.info(TAG, e)
      return e;
    }
  }

  async setLatestRollbackInfo(packageHash: string): Promise<null | string> {
    try {
      this.mSettingsManager.setLatestRollbackInfo(packageHash);
      return Promise.resolve(packageHash);
    } catch (e) {
      CodePushUtils.log(e);
      Promise.reject(e);
    }
  }

  async isFirstRun(packageHash: string): Promise<boolean | null> {
    try {
      let isFirstRun = this.mCodePush.didUpdate()
        && packageHash != null
        && packageHash.length > 0
        && (packageHash === new CodePushUpdateManager('').getCurrentPackageHash());
      return Promise.resolve(isFirstRun);
    } catch (err) {
      CodePushUtils.log(err);
      Promise.reject(err);
    }
  }

  async recordStatusReported(statusReport: Record<string, any>) {
    try {
      new CodePushTelemetryManager(context).recordStatusReported(statusReport);
    } catch (err) {
      CodePushUtils.log(err);
    }
  }

  async saveStatusReportForRetry(statusReport: Record<string, any>) {
    try {
      new CodePushTelemetryManager(context).saveStatusReportForRetry(statusReport);
    } catch (err) {
      CodePushUtils.log(err);
    }
  }

  async downloadAndReplaceCurrentBundle(remoteBundleUrl: string) {

  }

  restartAppInternal(onlyIfUpdateIsPending: boolean) {
    this.loadBundle();
  }

  async allow() {
    return new Promise((resolve) => {
      Logger.info(TAG, "Re-allowing restarts");
      if (this._restartQueue.length > 0) {
        Logger.info(TAG, "Executing pending restart");
        let buf: boolean = this._restartQueue[0];
        this._restartQueue.splice(0, 1);
        this.restartAppInternal(buf);
      }
      resolve(null);
    })
  }

  async notifyApplicationReady() {
    try {
      this.mSettingsManager.removePendingUpdate();
      return Promise.resolve("");
    } catch (err) {
      CodePushUtils.log(err);
      Promise.reject(err);
    }
  }

  async clearUpdates() {
    CodePushUtils.log("Clearing updates.");
    this.mCodePush.clearUpdates()
  }

  async getBundle(path: string): Promise<ArrayBuffer> {
    try {
      const file = await fs.open(path, fs.OpenMode.READ_ONLY);
      const { size } = await fs.stat(file.fd);
      const buffer = new ArrayBuffer(size);
      await fs.read(file.fd, buffer, { length: size });
      return buffer;
    } catch (err) {

    }
  }

  private async loadBundle(): Promise<void> {
    Logger.info(TAG, "restartAppInternal--loadBundle-start");
    let info = new CodePushUpdateManager('').getCurrentPackageInfo();
    let currentPackageHash: string = info[CodePushConstants.CURRENT_PACKAGE_KEY];
    const sx_latestJSBundleFile = context.filesDir + '/CodePush/' + currentPackageHash;
    const local_address = context.filesDir;
    let listFileOption: ListFileOptions = {
      recursion: false,
      listNum: 0
    }
    try {
      let filenames = fs.listFileSync(sx_latestJSBundleFile, listFileOption);
      const getBundleCont = sx_latestJSBundleFile + '/' + filenames[0];
      const new_getBundleCont = sx_latestJSBundleFile + '/Bundles';
      fs.renameSync(getBundleCont,new_getBundleCont);
      fs.copyDirSync(new_getBundleCont,local_address,1)
      this.ready = true
    }catch (error) {
      Logger.error(TAG, `restartAppInternal--loadBundle-end,error=${JSON.stringify(error)}`);
    }
    Logger.info(TAG, "restartAppInternal--loadBundle-end");
    if(this.installMode === 0 || this.installMode === -1){
      this.ctx.devToolsController.eventEmitter.emit("RELOAD", { reason: 'HotReload2' })
    }
    Logger.info(TAG, "restartAppInternal RELOAD end");
  }

  public getLatestRollbackInfo(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      try {
        let latestRollbackInfo: object = this.mSettingsManager.getLatestRollbackInfo();
        if (latestRollbackInfo != null) {
          resolve(JSON.stringify(latestRollbackInfo));
        } else {
          resolve(null);
        }
      } catch (err) {
        CodePushUtils.log(err);
        reject(err);
      }
    })
  }
}