import React from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../types';
import { useCompany } from '../context/CompanyContext';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { company } = useCompany();

  const productUrl = company
    ? `/${company.slug}/producto/${product.id}`
    : `/producto/${product.id}`; // Fallback for non-company pages

  return (
    <div className="group relative flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-300">
      <div className="aspect-w-1 aspect-h-1 bg-gray-200 overflow-hidden">
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-center object-cover group-hover:opacity-75 transition-opacity duration-300"
        />
      </div>
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-md font-serif text-brand-text">
          <Link to={productUrl}>
            <span aria-hidden="true" className="absolute inset-0" />
            {product.name}
          </Link>
        </h3>
        <p className="text-sm text-gray-500 mt-1">{product.category}</p>
        <div className="flex-grow"></div>
        <p className="text-lg font-semibold text-brand-primary mt-2">
          Desde ${product.price.toFixed(2)}
        </p>
      </div>
      <div
        className="text-center py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-semibold"
        style={{
          background: 'var(--brand-primary)',
          color: 'var(--brand-on-primary)',
        }}
      >
        Ver más
      </div>
    </div>
  );
};

export default ProductCard;
