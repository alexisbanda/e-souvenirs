import React, { useEffect, useState } from 'react';
import { getCompanies, getCompany } from '../../services/companyService';
import { Company } from '../../types/company';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const CompanyListPage: React.FC = () => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompanies = async () => {
      if (!user) return;
      try {
        if (user.role === 'superadmin') {
          const companyList = await getCompanies();
          setCompanies(companyList);
        } else if (user.companyId) {
          const company = await getCompany(user.companyId);
          setCompanies(company ? [company] : []);
        }
      } catch (error) {
        console.error("Error fetching companies:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, [user]);

  if (loading) {
    return <div>Loading companies...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Companies</h1>
        {user?.role === 'superadmin' && (
          <Link to="/admin/companies/new" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            New Company
          </Link>
        )}
      </div>
      <div className="bg-white shadow-md rounded-lg">
        <ul className="divide-y divide-gray-200">
          {companies.map(company => (
            <li key={company.id} className="p-4 hover:bg-gray-50 flex justify-between items-center">
              <Link to={`/${company.slug}/admin`} className="flex-grow">
                <div>
                  <p className="font-semibold">{company.name}</p>
                  <p className="text-sm text-gray-500">{company.slug}</p>
                </div>
              </Link>
              <Link to={`/admin/companies/edit/${company.id}`} className="text-blue-500 hover:text-blue-700">
                Edit
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default CompanyListPage;