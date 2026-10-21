import React from "react";

function TodaysNew() {
  return (
    <div className="border-gray-200 p-4 rounded-3xl border mt-10">
      <h1 className="font-bold my-4 text-[22px]">Today's News</h1>

      <div className="flex flex-col">
        <p className="truncate font-bold mb-2">
          Lorem, ipsum dolor sit amet consectetur adipisicing elit. Pariatur
          corporis, expedita repellendus dignissimos dolor cum cupiditate
          doloremque? Illum reprehenderit iste dolor, sit voluptas iusto tempora
          tenetur commodi veniam voluptates doloremque?
        </p>

        <div className="flex items-center">
          <img className="w-10" src="/avatar.png"/>
          <span className="text-gray-400">1 hour left</span>
        </div>
      </div>
    </div>
  );
}

export default TodaysNew;
