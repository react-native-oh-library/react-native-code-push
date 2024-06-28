import dataPreferences from '@ohos.data.preferences';
import { Context } from '@kit.AbilityKit';
import { CodePushConstants } from './CodePushConstants';
import { BusinessError } from "@ohos.base";


export class CodePushTelemetryManager {
  private preferences: dataPreferences.Preferences | null = null;
  private readonly APP_VERSION_KEY: string = "appVersion";
  private readonly DEPLOYMENT_FAILED_STATUS: string = "DeploymentFailed";
  private readonly DEPLOYMENT_KEY_KEY: string = "deploymentKey";
  private readonly DEPLOYMENT_SUCCEEDED_STATUS: string = "DeploymentSucceeded";
  private readonly LABEL_KEY: string = "label";
  private readonly LAST_DEPLOYMENT_REPORT_KEY: string = "CODE_PUSH_LAST_DEPLOYMENT_REPORT";
  private readonly PACKAGE_KEY: string = "package";
  private readonly PREVIOUS_DEPLOYMENT_KEY_KEY: string = "previousDeploymentKey";
  private readonly PREVIOUS_LABEL_OR_APP_VERSION_KEY: string = "previousLabelOrAppVersion";
  private readonly RETRY_DEPLOYMENT_REPORT_KEY: string = "CODE_PUSH_RETRY_DEPLOYMENT_REPORT";
  private readonly STATUS_KEY: string = "status";

  constructor(context: Context) {
    dataPreferences.getPreferences(context, CodePushConstants.CODE_PUSH_PREFERENCES,
      (err: BusinessError, val: dataPreferences.Preferences) => {
        if (err) {
          console.error("Failed to get preferences. code =" + err.code + ", message =" + err.message);
          return;
        }
        this.preferences = val;
        console.info("Succeeded in getting preferences.");
      })
  }

  public getBinaryUpdateReport(appVersion: string): Record<string, string> | null {
    const previousStatusReportIdentifier: string | null = this.getPreviousStatusReportIdentifier();
    let reportMap: Record<string, string> | null = null;

    if (previousStatusReportIdentifier === null) {
      this.clearRetryStatusReport();
      reportMap = {
        [this.APP_VERSION_KEY]: appVersion
      };
    } else if (previousStatusReportIdentifier !== appVersion) {
      this.clearRetryStatusReport();
      reportMap = {};

      if (this.isStatusReportIdentifierCodePushLabel(previousStatusReportIdentifier)) {
        const previousDeploymentKey: string =
          this.getDeploymentKeyFromStatusReportIdentifier(previousStatusReportIdentifier);
        const previousLabel: string = this.getVersionLabelFromStatusReportIdentifier(previousStatusReportIdentifier);

        reportMap[this.APP_VERSION_KEY] = appVersion;
        reportMap[this.PREVIOUS_DEPLOYMENT_KEY_KEY] = previousDeploymentKey;
        reportMap[this.PREVIOUS_LABEL_OR_APP_VERSION_KEY] = previousLabel;
      } else {
        // Previous status report was with a binary app version.
        reportMap[this.APP_VERSION_KEY] = appVersion;
        reportMap[this.PREVIOUS_LABEL_OR_APP_VERSION_KEY] = previousStatusReportIdentifier;
      }
    }

    return reportMap;
  }

  public getRetryStatusReport() {
    let retryStatusReportString: dataPreferences.ValueType =
      this.preferences.getSync(this.RETRY_DEPLOYMENT_REPORT_KEY, null) as string;
    if (retryStatusReportString != null) {
      this.clearRetryStatusReport();
      try {
        const retryStatusReport: Record<string, any> = JSON.parse(retryStatusReportString);
        // return CodePushUtils.convertJsonObjectToWritable(retryStatusReport);
        return retryStatusReport;
      } catch (e) {
        e.printStackTrace();
      }
    }
    return null;
  }

  public getRollbackReport(lastFailedPackage: Record<string, any>): Record<string, any> {
    const reportMap: Record<string, any> = {};
    reportMap[this.PACKAGE_KEY] = lastFailedPackage;
    reportMap[this.STATUS_KEY] = this.DEPLOYMENT_FAILED_STATUS;
    return reportMap;
  }

  public getUpdateReport(currentPackage: Record<string, any>): Record<string, any> {
    const currentPackageIdentifier: string = this.getPackageStatusReportIdentifier(currentPackage);
    const previousStatusReportIdentifier: string = this.getPreviousStatusReportIdentifier();
    let reportMap: Record<string, any> = null;
    if (currentPackageIdentifier != null) {
      if (previousStatusReportIdentifier == null) {
        this.clearRetryStatusReport();
        reportMap = {};
        reportMap.set(this.PACKAGE_KEY, currentPackage);
        reportMap.set(this.STATUS_KEY, this.DEPLOYMENT_SUCCEEDED_STATUS);
      } else if (previousStatusReportIdentifier != currentPackageIdentifier) {
        this.clearRetryStatusReport();
        reportMap = {};
        if (this.isStatusReportIdentifierCodePushLabel(previousStatusReportIdentifier)) {
          let previousDeploymentKey: string =
            this.getDeploymentKeyFromStatusReportIdentifier(previousStatusReportIdentifier);
          let previousLabel: string = this.getVersionLabelFromStatusReportIdentifier(previousStatusReportIdentifier);
          reportMap.set(this.PACKAGE_KEY, currentPackage);
          reportMap.set(this.STATUS_KEY, this.DEPLOYMENT_SUCCEEDED_STATUS);
          reportMap.set(this.PREVIOUS_DEPLOYMENT_KEY_KEY, previousDeploymentKey);
          reportMap.set(this.PREVIOUS_LABEL_OR_APP_VERSION_KEY, previousLabel);
        } else {
          // Previous status report was with a binary app version.
          reportMap.set(this.PACKAGE_KEY, currentPackage);
          reportMap.set(this.STATUS_KEY, this.DEPLOYMENT_SUCCEEDED_STATUS);
          reportMap.set(this.PREVIOUS_LABEL_OR_APP_VERSION_KEY, previousStatusReportIdentifier);
        }
      }
    }

    return reportMap;
  }

  public recordStatusReported(statusReport: Record<string, any>): void {
    // We don't need to record rollback reports, so exit early if that's what was specified.
    if (statusReport.hasKey(this.STATUS_KEY) && this.DEPLOYMENT_FAILED_STATUS === statusReport.get(this.STATUS_KEY)) {
      return;
    }

    if (statusReport.hasKey(this.APP_VERSION_KEY)) {
      this.saveStatusReportedForIdentifier(statusReport.get(this.APP_VERSION_KEY));
    } else if (statusReport.hasKey(this.PACKAGE_KEY)) {
      const packageIdentifier: string = this.getPackageStatusReportIdentifier(statusReport.get(this.PACKAGE_KEY));
      this.saveStatusReportedForIdentifier(packageIdentifier);
    }
  }

  public saveStatusReportForRetry(statusReport: Record<string, any>): void {
    this.preferences.put(this.RETRY_DEPLOYMENT_REPORT_KEY, JSON.stringify(statusReport));
  }

  private getPackageStatusReportIdentifier(updatePackage: Record<string, any>): string {
    // Because deploymentKeys can be dynamically switched, we use a
    // combination of the deploymentKey and label as the packageIdentifier.
    const deploymentKey: string = updatePackage.get(this.DEPLOYMENT_KEY_KEY);
    const label: string = updatePackage.get(this.LABEL_KEY);

    if (deploymentKey != null && label != null) {
      return deploymentKey + ":" + label;
    } else {
      return null;
    }
  }

  private getPreviousStatusReportIdentifier(): string {
    return this.preferences.getSync(this.LAST_DEPLOYMENT_REPORT_KEY, null) as string;
  }

  private clearRetryStatusReport(): void {
    this.preferences.delete(this.RETRY_DEPLOYMENT_REPORT_KEY);
  }

  private isStatusReportIdentifierCodePushLabel(statusReportIdentifier: string): boolean {
    return statusReportIdentifier != null && statusReportIdentifier.includes(":");
  }

  private getDeploymentKeyFromStatusReportIdentifier(statusReportIdentifier: string): string {
    const parsedIdentifier: string[] = statusReportIdentifier.split(":");
    if (parsedIdentifier.length > 0) {
      return parsedIdentifier[0];
    } else {
      return null;
    }
  }

  private getVersionLabelFromStatusReportIdentifier(statusReportIdentifier: string): string {
    const parsedIdentifier: string[] = statusReportIdentifier.split(":");
    if (parsedIdentifier.length > 1) {
      return parsedIdentifier[1];
    } else {
      return null;
    }
  }

  private saveStatusReportedForIdentifier(appVersionOrPackageIdentifier: string): void {
    this.preferences.put(this.LAST_DEPLOYMENT_REPORT_KEY, appVersionOrPackageIdentifier);
  }
}