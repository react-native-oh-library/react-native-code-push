import common from '@ohos.app.ability.common';
import { CodePushUpdateManager } from './CodePushUpdateManager';
import { SettingsManager } from './SettingsManager';
import { bundleManager } from '@kit.AbilityKit';
import { CodePushUnknownException } from './CodePushUnknownException';
import HashMap from '@ohos.util.HashMap';
import { CodePushConstants } from './CodePushConstants';
import { CodePushNotInitializedException } from './CodePushNotInitializedException';
import { CodePushUtils } from './CodePushUtils';
import Logger from './Logger';

const TAG = 'CodePushInstance'

export class CodePush {
  private static sIsRunningBinaryVersion: boolean = false;
  private static sNeedToReportRollback: boolean = false;
  private static sTestConfigurationFlag: boolean = false;
  private sAppVersion: string = null;
  private mDidUpdate: boolean = false;
  private mAssetsBundleFileName: string = '';

  // Helper classes.
  private mUpdateManager: CodePushUpdateManager | null = null;
  private mSettingsManager: SettingsManager | null;

  // Config properties.
  private mDeploymentKey: string = '';
  private mServerUrl: string = "https://codepush.appcenter.ms/";

  private mContext: common.UIAbilityContext | null = null;
  private mIsDebugMode: boolean = false;

  private static mPublicKey: string = '';
  private mCurrentInstance: CodePush | null = null;
  static mSettingsManager: SettingsManager | null = null;
  static context: common.UIAbilityContext;


  constructor(deploymentKey: string, context: common.UIAbilityContext, isDebugMode: boolean,
    publicKeyResourceDescriptor?: number) {
    Logger.info(TAG,
      `constructor start param, deploymentKey: ${deploymentKey}, isDebugMode: ${isDebugMode?.toString()}`)
    this.mContext = context;

    this.mUpdateManager = new CodePushUpdateManager(this.mContext.filesDir);
    this.mDeploymentKey = deploymentKey;
    this.mIsDebugMode = isDebugMode;
    this.mSettingsManager = new SettingsManager();
    if (this.sAppVersion == null) {
      try {
        let bundleFlags = bundleManager.BundleFlag.GET_BUNDLE_INFO_DEFAULT;
        bundleManager.getBundleInfoForSelf(bundleFlags).then((appInfo) => {
          this.sAppVersion = appInfo.versionName;
          Logger.info(TAG, `constructor sAppVersion ${this.sAppVersion}`);
        });
      } catch (e) {
        Logger.error(TAG, `constructor sAppVersion error: ${JSON.stringify(e)}`);
      }
    }

    this.mCurrentInstance = this;
    const publicKeyFromStrings: string = this.getCustomPropertyFromStringsIfExist("PublicKey");
    if (publicKeyFromStrings != null) {
      CodePush.mPublicKey = publicKeyFromStrings;
    }

    const serverUrlFromStrings: string = this.getCustomPropertyFromStringsIfExist("ServerUrl");
    if (serverUrlFromStrings != null) {
      this.mServerUrl = serverUrlFromStrings;
    }

  }

  static isUsingTestConfiguration(): boolean {
    return CodePush.sTestConfigurationFlag;
  }


  public didUpdate(): boolean {
    return this.mDidUpdate;
  }

  public getAppVersion(): string {
    return this.sAppVersion;
  }

  public getAssetsBundleFileName(): string {
    return this.mAssetsBundleFileName;
  }

  public getPublicKey(): string {
    return CodePush.mPublicKey;
  }

  public String

  getPackageFolder(): string {
    const codePushLocalPackage = this.mUpdateManager.getCurrentPackage();
    if (codePushLocalPackage == null) {
      return null;
    }
    return this.mUpdateManager.getPackageFolderPath(codePushLocalPackage.get("packageHash"));
  }

  getBundleUrl(assetsBundleFileName?: string): string {
    if (assetsBundleFileName) {
      return this.getJSBundleFile(assetsBundleFileName);
    }
    return this.getJSBundleFile();
  }

  getContext(): any {
    return this.mContext;
  }

  getDeploymentKey(): string {
    return this.mDeploymentKey;
  }

  getJSBundleFile(assetsBundleFileName?: string): string {

    if (!this.mCurrentInstance) {
      throw new CodePushNotInitializedException("A CodePush instance has not been created yet. Have you added it to your app's list of ReactPackages?");
    }
    if (assetsBundleFileName) {
      return this.getJSBundleFile(CodePushConstants.DEFAULT_JS_BUNDLE_NAME);
    }
    return this.mCurrentInstance.getJSBundleFileInternal(assetsBundleFileName);
  }

  getJSBundleFileInternal(assetsBundleFileName: string): string {
    this.mAssetsBundleFileName = assetsBundleFileName; //mAssetsBundleFileName=index.android.bundle
    const binaryJsBundleUrl: string = CodePushConstants.ASSETS_BUNDLE_PREFIX + assetsBundleFileName;
    let packageFilePath: string = null;
    try {
      //mAssetsBundleFileName=index.android.bundle
      packageFilePath = this.mUpdateManager.getCurrentPackageBundlePath(this.mAssetsBundleFileName);
    } catch (CodePushMalformedDataException) {
      // We need to recover the app in case 'codepush.json' is corrupted
      CodePushUtils.log(CodePushMalformedDataException);
      this.clearUpdates();
    }

    if (packageFilePath == null) {
      // There has not been any downloaded updates.
      CodePushUtils.log("Loading JS bundle from \"" + binaryJsBundleUrl + "\"");
      CodePush.sIsRunningBinaryVersion = true;
      return binaryJsBundleUrl; //assets://index.android.bundle
    }

    const packageMetadata = this.mUpdateManager.getCurrentPackage();
    if (this.isPackageBundleLatest(packageMetadata)) {
      CodePushUtils.logBundleUrl(packageFilePath);
      CodePush.sIsRunningBinaryVersion = false;
      return packageFilePath;
    } else {
      // The binary version is newer.
      this.mDidUpdate = false;
      if (!this.mIsDebugMode || this.hasBinaryVersionChanged(packageMetadata)) {
        this.clearUpdates();
      }

      CodePushUtils.logBundleUrl(binaryJsBundleUrl);
      CodePush.sIsRunningBinaryVersion = true;
      return binaryJsBundleUrl;
    }
  }

  private hasBinaryVersionChanged(packageMetadata: HashMap<string, any>): boolean {
    const packageAppVersion: string = packageMetadata.get("appVersion");
    return !(this.sAppVersion === packageAppVersion);
  }

  needToReportRollback(): boolean {
    return CodePush.sNeedToReportRollback;
  }

  overrideAppVersion(appVersionOverride: string): void {
    this.sAppVersion = appVersionOverride;
  }

  setNeedToReportRollback(needToReportRollback: boolean): void {
    CodePush.sNeedToReportRollback = needToReportRollback;
  }

  setDeploymentKey(deploymentKey: string): void {
    this.mDeploymentKey = deploymentKey;
  }

  static setUsingTestConfiguration(shouldUseTestConfiguration: boolean): void {
    this.sTestConfigurationFlag = shouldUseTestConfiguration;
  }

  clearUpdates(): void {
    this.mUpdateManager.clearUpdates();
    this.mSettingsManager.removePendingUpdate();
    this.mSettingsManager.removeFailedUpdates();
  }

  private isPackageBundleLatest(packageMetadata: HashMap<string, any>): boolean {
    try {
      let binaryModifiedDateDuringPackageInstall = null;
      let binaryModifiedDateDuringPackageInstallString: string =
        packageMetadata.get(CodePushConstants.BINARY_MODIFIED_TIME_KEY);
      if (binaryModifiedDateDuringPackageInstallString != null) {
        binaryModifiedDateDuringPackageInstall = parseInt(binaryModifiedDateDuringPackageInstallString);
      }
      let packageAppVersion: string = packageMetadata.get("appVersion");
      return binaryModifiedDateDuringPackageInstall &&
        (CodePush.isUsingTestConfiguration() || this.sAppVersion === packageAppVersion);
    } catch (e) {
      throw new CodePushUnknownException("Error in reading binary modified date from package metadata", e);
    }
  }

  private getCustomPropertyFromStringsIfExist(propertyName: string): string {
    let result: string;
    try {
      result = this.mContext.resourceManager.getStringByNameSync(propertyName);
      Logger.info(TAG, `getCustomPropertyFromStringsIfExist propertyName: ${propertyName}, result: ${result}`);
    } catch (error) {
      Logger.error(TAG,
        `getCustomPropertyFromStringsIfExist propertyName: ${propertyName}, error: ${JSON.stringify(error)}`);
    }
    return result;
  }

  isDebugMode(): boolean {
    return this.mIsDebugMode;
  }

  getServerUrl(): string {
    return this.mServerUrl;
  }

  isRunningBinaryVersion(): boolean {
    return CodePush.sIsRunningBinaryVersion;
  }

  invalidateCurrentInstance() {
    this.mCurrentInstance = null;
  }
}
