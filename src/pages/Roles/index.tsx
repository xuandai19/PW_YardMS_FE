import {useEffect,useState} from 'react';
import {Table,Tag,message} from 'antd';
import {api} from '../../services/api';
export default function RolesPage(){
 const [data,setData]=useState<any[]>([]);
 useEffect(()=>{api.get('/roles').then(r=>setData(r.data.data)).catch((e)=>message.error(e.response?.data?.message ?? 'Không thể tải vai trò'))},[]);
 return <><h2 className="text-xl font-semibold mb-4">Role & Permission Management</h2><Table rowKey="id" dataSource={data} columns={[{title:'Code',dataIndex:'code'},{title:'Name',dataIndex:'name'},{title:'Permissions',dataIndex:'permissions',render:(x:string[])=>x?.map(permission=><Tag key={permission}>{permission}</Tag>)}]}/></>;
}
