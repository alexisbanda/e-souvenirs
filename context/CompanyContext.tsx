import React, { createContext, useContext } from 'react';
import { Company } from '../types/company';

interface CompanyContextType {
  company: Company | null;
}

const CompanyContext = createContext<CompanyContextType>({ company: null });

export const useCompany = () => useContext(CompanyContext);

export const CompanyProvider: React.FC<{ company: Company, children: React.ReactNode }> = ({ company, children }) => {
  return (
    <CompanyContext.Provider value={{ company }}>
      {children}
    </CompanyContext.Provider>
  );
};
