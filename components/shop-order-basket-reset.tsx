'use client';
import {useEffect} from 'react';
export default function ShopOrderBasketReset({id,paid}:{id:string;paid:boolean}){
  useEffect(()=>{try{
    if(JSON.parse(sessionStorage.getItem('academy-shop-attempt')||'null')?.id===id){
      sessionStorage.removeItem('academy-shop-attempt');
      if(paid)sessionStorage.removeItem('academy-basket');
    }
  }catch{}},[id,paid]);
  return null;
}
