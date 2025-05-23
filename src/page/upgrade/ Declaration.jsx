import React, { useRef, useEffect, useState } from "react";
import { Stepper } from "primereact/stepper";
import { StepperPanel } from "primereact/stepperpanel";
import { Button } from "primereact/button";
import { useSelector } from "react-redux";
import GetCompanyInfo from "../../Utils/GetCompayInfo";

export default function Declaration() {
  const stepperRef = useRef(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const taxCode = useSelector((state) => state.taxCode.value);

  useEffect(() => {
    const fetchCompanyInfo = async () => {
      if (!taxCode) return;
      try {
        setLoadingCompany(true);
        const result = await GetCompanyInfo(taxCode);
        if (result.success) {
          setCompanyInfo(result.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingCompany(false);
      }
    };

    fetchCompanyInfo();
  }, [taxCode]);

  return (
    <div className="card flex justify-content-center">
      <Stepper ref={stepperRef} style={{ flexBasis: "50rem" }}>
        <StepperPanel header="Thông tin DK01 1.0">
          <div className="flex flex-column h-[30rem]">
            <div className="border-2 border-dashed surface-border border-round surface-ground flex-auto flex flex-col p-4">
              {loadingCompany ? (
                <div className="flex justify-center items-center h-full">
                  <div className="text-gray-600">Đang tải thông tin...</div>
                </div>
              ) : companyInfo ? (
                <div className="space-y-3">
                  <div className="flex items-center">
                    <span className="font-semibold text-gray-600 w-40">
                      Mã số thuế:
                    </span>
                    <span className="text-gray-800">{companyInfo.taxCode}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold text-gray-600 w-40">
                      Tên doanh nghiệp:
                    </span>
                    <span className="text-gray-800">
                      {companyInfo.companyName}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold text-gray-600 w-40">
                      Địa chỉ:
                    </span>
                    <span className="text-gray-800">{companyInfo.address}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold text-gray-600 w-40">
                      Điện thoại:
                    </span>
                    <span className="text-gray-800">{companyInfo.phone}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold text-gray-600 w-40">
                      Email:
                    </span>
                    <span className="text-gray-800">{companyInfo.email}</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center items-center h-full">
                  <div className="text-gray-600">
                    Vui lòng nhập mã số thuế để xem thông tin
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex pt-4 justify-content-end">
            <Button
              label="Next"
              icon="pi pi-arrow-right"
              iconPos="right"
              onClick={() => stepperRef.current.nextCallback()}
            />
          </div>
        </StepperPanel>
        <StepperPanel header="Header II">
          <div className="flex flex-column h-12rem">
            <div className="border-2 border-dashed surface-border border-round surface-ground flex-auto flex justify-content-center align-items-center font-medium">
              Content II
            </div>
          </div>
          <div className="flex pt-4 justify-content-between">
            <Button
              label="Back"
              severity="secondary"
              icon="pi pi-arrow-left"
              onClick={() => stepperRef.current.prevCallback()}
            />
            <Button
              label="Next"
              icon="pi pi-arrow-right"
              iconPos="right"
              onClick={() => stepperRef.current.nextCallback()}
            />
          </div>
        </StepperPanel>
        <StepperPanel header="Header III">
          <div className="flex flex-column h-12rem">
            <div className="border-2 border-dashed surface-border border-round surface-ground flex-auto flex justify-content-center align-items-center font-medium">
              Content III
            </div>
          </div>
          <div className="flex pt-4 justify-content-start">
            <Button
              label="Back"
              severity="secondary"
              icon="pi pi-arrow-left"
              onClick={() => stepperRef.current.prevCallback()}
            />
          </div>
        </StepperPanel>
      </Stepper>
    </div>
  );
}
