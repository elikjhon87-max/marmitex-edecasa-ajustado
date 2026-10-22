export interface BusinessSettings {
whatsappPrincipal: string;
whatsappSecundario: string;
endereco: string;
tempoPreparo: number;
taxaBase: number;
precoPorKm: number;
horariosAlmoco: { abre: string; fecha: string };
horariosJanta: { abre: string; fecha: string };
diasFechados: string[];
chavePix: string;
aceitaCartaoEntrega: boolean;
}

export interface MenuItem {
id: string;
title: string;
description: string;
price: number;
category: string;
active: boolean;
}

export interface OrderItem {
id: string;
title: string;
price: number;
quantity: number;
notes?: string;
}

export interface Order {
id: string;
customerName: string;
customerPhone: string;
address: string;
items: OrderItem[];
subtotal: number;
deliveryFee: number;
total: number;
paymentMethod: 'pix' | 'debito' | 'credito' | 'dinheiro';
status: 'pending' | 'preparing' | 'delivering' | 'completed' | 'cancelled';
createdAt: string;
scheduledFor: 'almoco' | 'janta';
}