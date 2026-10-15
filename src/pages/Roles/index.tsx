import {useEffect,useState} from 'react';
import {Table,Tag} from 'antd';
import {api} from '../../services/api';
export default function RolesPage(){
 const [data,setData]=useState<any[]>([]);
 useEffect(()=>{api.get('/roles').then(r=>setData(r.data.data))},[]);
 return <><h2 className="text-xl font-semibold mb-4">Role & Permission Management</h2><Table rowKey="id" dataSource={data} columns={[{title:'Code',dataIndex:'code'},{title:'Name',dataIndex:'name'},{title:'Permissions',dataIndex:'permissions',render:(x:any[])=>x?.map(p=><Tag key={p.id}>{p.code}</Tag>)}]}/></>;
}
