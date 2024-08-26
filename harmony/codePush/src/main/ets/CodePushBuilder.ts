import common from '@ohos.app.ability.common';
import { CodePush } from './CodePush'
import bundleManager from '@ohos.bundle.bundleManager';
import Logger from './Logger';

declare function getContext(context: any): common.UIAbilityContext;

let context = getContext(this) as common.UIAbilityContext;

const TAG = 'CodePushNativeModule-CodePushBuilder: '

export class CodePushBuilder {
  private mDeploymentKey: string = '';
  private mIsDebugMode: boolean = false;
  private mPublicKeyResourceDescriptor: number = -1;

  constructor() {
    let bundleFlags = bundleManager.BundleFlag.GET_BUNDLE_INFO_WITH_APPLICATION;
    let bundleInfo = bundleManager.getBundleInfoForSelfSync(bundleFlags);
    let isDebug = bundleInfo.appInfo.debug
    Logger.info(TAG, `CodePushBuilder isDebug:${isDebug}`)
    let deploymentKeyConfigName;
    if (isDebug) {
      deploymentKeyConfigName = 'Staging';
    } else {
      deploymentKeyConfigName = 'Production';
    }
    let deploymentKey = AppStorage.Get("CodePushConfig")[deploymentKeyConfigName];
    this.mDeploymentKey = deploymentKey;
    Logger.info(TAG, `CodePushBuilder getDeploymentKey:${deploymentKey}`)
  }

  public setIsDebugMode(isDebugMode: boolean) {
    this.mIsDebugMode = isDebugMode;
    return this;
  }

  public setPublicKeyResourceDescriptor(publicKeyResourceDescriptor: number) {
    this.mPublicKeyResourceDescriptor = publicKeyResourceDescriptor;
    return this;
  }

  public build() {
    return new CodePush(this.mDeploymentKey, context, this.mIsDebugMode, this.mPublicKeyResourceDescriptor);
  }
}